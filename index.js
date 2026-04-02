'use strict';

const PLUGIN_NAME = 'homebridge-auto-reset-contact';
const PLATFORM_NAME = 'AutoResetContactTrigger';

module.exports = (api) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, AutoResetContactPlatform);
};

class AutoResetContactPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;
    this.accessories = new Map();

    this.api.on('didFinishLaunching', () => {
      this.log.info(`[${PLATFORM_NAME}] didFinishLaunching`);
      this.discoverDevices();
    });
  }

  configureAccessory(accessory) {
    this.accessories.set(accessory.UUID, accessory);
  }

  discoverDevices() {
    const entries = Array.isArray(this.config.accessories) ? this.config.accessories : [];

    if (entries.length === 0) {
      this.log.warn(`[${PLATFORM_NAME}] No accessories configured`);
      return;
    }

    const configuredUuids = new Set();

    for (const entry of entries) {
      const device = this.normaliseConfig(entry);
      const uuid = this.api.hap.uuid.generate(`${PLUGIN_NAME}:${device.name}`);
      configuredUuids.add(uuid);

      const existing = this.accessories.get(uuid);

      if (existing) {
        this.log.info(`[${PLATFORM_NAME}] Restoring existing accessory: ${device.name}`);
        existing.context.device = device;
        new AutoResetContactAccessory(this, existing, device);
      } else {
        this.log.info(`[${PLATFORM_NAME}] Creating new accessory: ${device.name}`);
        const accessory = new this.api.platformAccessory(device.name, uuid);
        accessory.context.device = device;

        new AutoResetContactAccessory(this, accessory, device);

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.set(uuid, accessory);
      }
    }

    for (const [uuid, accessory] of this.accessories.entries()) {
      if (!configuredUuids.has(uuid)) {
        this.log.info(`[${PLATFORM_NAME}] Removing stale accessory: ${accessory.displayName}`);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.delete(uuid);
      }
    }
  }

  normaliseConfig(entry) {
    const name = typeof entry?.name === 'string' && entry.name.trim() ? entry.name.trim() : 'Auto Reset Contact';
    const triggerName = typeof entry?.triggerName === 'string' && entry.triggerName.trim() ? entry.triggerName.trim() : 'Trigger';
    const sensorName = typeof entry?.sensorName === 'string' && entry.sensorName.trim() ? entry.sensorName.trim() : name;

    let resetAfterSeconds = Number(entry?.resetAfterSeconds);
    if (!Number.isFinite(resetAfterSeconds) || resetAfterSeconds < 1) {
      resetAfterSeconds = 10;
    }

    const triggeredState = entry?.triggeredState === 'open' ? 'open' : 'closed';
    const initialState = entry?.initialState === 'closed' ? 'closed' : 'open';

    return {
      name,
      triggerName,
      sensorName,
      resetAfterSeconds,
      triggeredState,
      initialState,
    };
  }
}

class AutoResetContactAccessory {
  constructor(platform, accessory, config) {
    this.platform = platform;
    this.accessory = accessory;
    this.config = config;

    this.Service = this.platform.api.hap.Service;
    this.Characteristic = this.platform.api.hap.Characteristic;

    this.resetTimer = null;
    this.isTriggered = false;

    this.triggeredSensorState =
      this.config.triggeredState === 'closed'
        ? this.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
        : this.Characteristic.ContactSensorState.CONTACT_DETECTED;

    this.initialSensorState =
      this.config.initialState === 'closed'
        ? this.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
        : this.Characteristic.ContactSensorState.CONTACT_DETECTED;

    this.setupInformationService();
    this.setupSwitchService();
    this.setupContactSensorService();

    this.platform.log.info(
      `[${PLATFORM_NAME}] Accessory ready: ${this.config.name}, switch="${this.config.triggerName}", sensor="${this.config.sensorName}"`
    );
  }

  setupInformationService() {
    this.informationService =
      this.accessory.getService(this.Service.AccessoryInformation) ||
      this.accessory.addService(this.Service.AccessoryInformation);

    this.informationService
      .setCharacteristic(this.Characteristic.Manufacturer, 'ChatGPT')
      .setCharacteristic(this.Characteristic.Model, 'Auto Reset Contact')
      .setCharacteristic(this.Characteristic.SerialNumber, `arc-${this.accessory.UUID.slice(0, 8)}`)
      .setCharacteristic(this.Characteristic.FirmwareRevision, '1.2.0');
  }

  setupSwitchService() {
    this.switchService =
      this.accessory.getServiceById(this.Service.Switch, 'trigger') ||
      this.accessory.addService(this.Service.Switch, this.config.triggerName, 'trigger');

    this.switchService.setCharacteristic(this.Characteristic.Name, this.config.triggerName);
    this.switchService.getCharacteristic(this.Characteristic.On)
      .onGet(this.handleGetSwitch.bind(this))
      .onSet(this.handleSetSwitch.bind(this));
  }

  setupContactSensorService() {
    this.contactService =
      this.accessory.getServiceById(this.Service.ContactSensor, 'sensor') ||
      this.accessory.addService(this.Service.ContactSensor, this.config.sensorName, 'sensor');

    this.contactService.setCharacteristic(this.Characteristic.Name, this.config.sensorName);
    this.contactService.updateCharacteristic(
      this.Characteristic.ContactSensorState,
      this.initialSensorState
    );
  }

  handleGetSwitch() {
    return this.isTriggered;
  }

  async handleSetSwitch(value) {
    const turnOn = value === true;
    if (!turnOn) {
      return;
    }

    this.platform.log.info(`[${PLATFORM_NAME}] Triggered: ${this.config.name}`);

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    this.isTriggered = true;
    this.switchService.updateCharacteristic(this.Characteristic.On, true);
    this.contactService.updateCharacteristic(
      this.Characteristic.ContactSensorState,
      this.triggeredSensorState
    );

    this.resetTimer = setTimeout(() => {
      this.resetState();
    }, this.config.resetAfterSeconds * 1000);
  }

  resetState() {
    this.platform.log.info(`[${PLATFORM_NAME}] Resetting: ${this.config.name}`);

    this.isTriggered = false;
    this.resetTimer = null;

    this.contactService.updateCharacteristic(
      this.Characteristic.ContactSensorState,
      this.initialSensorState
    );

    this.switchService.updateCharacteristic(this.Characteristic.On, false);
  }
}
