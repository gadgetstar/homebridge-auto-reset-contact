# homebridge-auto-reset-contact

A Homebridge plugin that creates a single accessory containing:

- a writable **Trigger** switch
- an auto-resetting **Contact Sensor**

This is useful when you want a Home automation to cause a **notification-capable contact sensor event**, because Apple Home does not offer a generic **Notify Me** action inside automations.

## What it does

When the **Trigger** switch is turned on:

1. the contact sensor changes to the configured triggered state
2. Apple Home can send a notification from that contact sensor
3. after the configured delay, the contact sensor resets
4. the Trigger switch returns to off

## Typical use case

- Trigger: **Last person leaves home**
- Condition: **Alarm is disarmed**
- Action: turn on **Trigger**

That causes the contact sensor to change state and generate a Home notification such as your **Alarm Not Set Alert**.

## Installation

### From a local package

```bash
npm pack
sudo npm install -g ./homebridge-auto-reset-contact-1.2.0.tgz
```

### For Homebridge installs using strict plugin resolution

Install into the Homebridge plugin path, for example:

```bash
cd /var/lib/homebridge
sudo npm install /path/to/homebridge-auto-reset-contact-1.2.0.tgz
```

Then restart Homebridge.

### From github install
```bash
cd /var/lib/homebridge
npm install github:gadgetstar/homebridge-auto-reset-contact

## Configuration

### Example config

```json
{
  "platform": "AutoResetContactTrigger",
  "name": "Auto Reset Contact Trigger",
  "accessories": [
    {
      "name": "Alarm Not Set Alert",
      "triggerName": "Trigger",
      "sensorName": "Alarm Not Set Alert",
      "resetAfterSeconds": 10,
      "triggeredState": "closed",
      "initialState": "open"
    }
  ]
}
```

## Home app setup

1. Add the accessory to Apple Home if needed.
2. Open the contact sensor service.
3. Enable **Status and Notifications**.
4. Test by turning on the **Trigger** switch.

## Notes

- The wording for **open** and **closed** can look a little odd in Apple Home because of how HomeKit models contact sensors.
- If the wording bothers you, try flipping:
  - `triggeredState`
  - `initialState`
- The automation action must target the **Trigger switch**, not the contact sensor.

## Development

Basic package sanity check:

```bash
node -e "require('./index.js')"
```

Create a distributable tarball:

```bash
npm pack
```

## License

MIT
