// src/controllers/AlphaESSController.js
import ModbusRTU from 'modbus-serial';

class AlphaESSController {
  constructor(ip, port = 502, slaveId = 85) {
    this.client = new ModbusRTU();
    this.ip = ip;
    this.port = port;
    this.slaveId = slaveId;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async connect() {
    try {
      await this.client.connectTCP(this.ip, { port: this.port });
      this.client.setID(this.slaveId);
      this.client.setTimeout(5000);
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log(`✓ Connected to Alpha ESS at ${this.ip}:${this.port}`);
      return true;
    } catch (error) {
      this.connected = false;
      console.error('✗ Alpha ESS connection failed:', error.message);
      
      // Auto-reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.connect();
      }
      
      throw error;
    }
  }

  async disconnect() {
    if (this.client.isOpen) {
      this.client.close(() => {});
    }
    this.connected = false;
    console.log('✓ Disconnected from Alpha ESS');
  }

  // Helper: Convert 32-bit signed value
  convert32BitSigned(data) {
    let value = (data[0] << 16) | data[1];
    if (value > 0x7FFFFFFF) value -= 0x100000000;
    return value;
  }

  // Helper: Convert 32-bit unsigned value
  convert32BitUnsigned(data) {
    return (data[0] << 16) | data[1];
  }

  // Helper: Write 32-bit value to two registers
  async write32BitValue(startRegister, value) {
    const lowByte = value & 0xFFFF;
    const highByte = (value >> 16) & 0xFFFF;
    
    await this.client.writeRegister(startRegister, lowByte);
    await this.client.writeRegister(startRegister + 1, highByte);
  }

  /**
   * Get complete system status
   */
  async getCompleteStatus() {
    if (!this.connected) {
      throw new Error('Not connected to Alpha ESS');
    }

    try {
      // Battery (registers 0x0100-0x0103, 0x041B)
      const batterySOC = await this.client.readHoldingRegisters(0x0102, 1);
      const batteryVoltage = await this.client.readHoldingRegisters(0x0100, 1);
      const batteryCurrent = await this.client.readHoldingRegisters(0x0101, 2);
      const batteryPower = await this.client.readHoldingRegisters(0x041B, 2);
      const batteryTemp = await this.client.readHoldingRegisters(0x0103, 1);

      // Grid (registers 0x0470-0x049C)
      const gridPower = await this.client.readHoldingRegisters(0x0484, 2);
      const gridVoltageL1 = await this.client.readHoldingRegisters(0x0470, 2);
      const gridVoltageL2 = await this.client.readHoldingRegisters(0x0472, 2);
      const gridVoltageL3 = await this.client.readHoldingRegisters(0x0474, 2);
      const gridCurrentL1 = await this.client.readHoldingRegisters(0x0476, 2);
      const gridCurrentL2 = await this.client.readHoldingRegisters(0x0478, 2);
      const gridCurrentL3 = await this.client.readHoldingRegisters(0x047A, 2);
      const gridFrequency = await this.client.readHoldingRegisters(0x049C, 1);

      // PV AC-Coupled (registers 0x048A, 0x0488)
      const pvPower = await this.client.readHoldingRegisters(0x048A, 2);
      const pvEnergyToday = await this.client.readHoldingRegisters(0x0488, 2);
      const pvVoltageL1 = await this.client.readHoldingRegisters(0x0470, 2);
      const pvCurrentL1 = await this.client.readHoldingRegisters(0x0476, 2);

      // Load (registers 0x041A, 0x0492)
      const inverterPower = await this.client.readHoldingRegisters(0x041A, 2);
      const loadPower = await this.client.readHoldingRegisters(0x0492, 2);

      return {
        battery: {
          soc: batterySOC.data[0],
          voltage: batteryVoltage.data[0] * 0.1,
          current: this.convert32BitSigned(batteryCurrent.data) * 0.1,
          power: this.convert32BitSigned(batteryPower.data),
          temperature: batteryTemp.data[0] * 0.1,
        },
        grid: {
          power: this.convert32BitSigned(gridPower.data),
          voltageL1: this.convert32BitSigned(gridVoltageL1.data) * 0.1,
          voltageL2: this.convert32BitSigned(gridVoltageL2.data) * 0.1,
          voltageL3: this.convert32BitSigned(gridVoltageL3.data) * 0.1,
          currentL1: this.convert32BitSigned(gridCurrentL1.data) * 0.01,
          currentL2: this.convert32BitSigned(gridCurrentL2.data) * 0.01,
          currentL3: this.convert32BitSigned(gridCurrentL3.data) * 0.01,
          frequency: gridFrequency.data[0] * 0.01,
        },
        pv: {
          power: this.convert32BitSigned(pvPower.data),
          energyToday: this.convert32BitUnsigned(pvEnergyToday.data) * 0.01,
          voltageL1: this.convert32BitSigned(pvVoltageL1.data) * 0.1,
          currentL1: this.convert32BitSigned(pvCurrentL1.data) * 0.01,
        },
        load: {
          power: this.convert32BitSigned(loadPower.data),
          inverterPower: this.convert32BitSigned(inverterPower.data),
        },
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error reading from Alpha ESS:', error.message);
      this.connected = false;
      throw error;
    }
  }

  /**
   * Get AC-coupled PV details
   */
  async getACCoupledPVPower() {
    if (!this.connected) {
      throw new Error('Not connected to Alpha ESS');
    }

    try {
      const pvActivePower = await this.client.readHoldingRegisters(0x048A, 2);
      const pvVoltageL1 = await this.client.readHoldingRegisters(0x0470, 2);
      const pvVoltageL2 = await this.client.readHoldingRegisters(0x0472, 2);
      const pvVoltageL3 = await this.client.readHoldingRegisters(0x0474, 2);
      const pvCurrentL1 = await this.client.readHoldingRegisters(0x0476, 2);
      const pvCurrentL2 = await this.client.readHoldingRegisters(0x0478, 2);
      const pvCurrentL3 = await this.client.readHoldingRegisters(0x047A, 2);
      const pvEnergyToday = await this.client.readHoldingRegisters(0x0488, 2);
      const pvEnergyTotal = await this.client.readHoldingRegisters(0x0489, 2);

      return {
        activePower: this.convert32BitSigned(pvActivePower.data),
        voltageL1: this.convert32BitSigned(pvVoltageL1.data) * 0.1,
        voltageL2: this.convert32BitSigned(pvVoltageL2.data) * 0.1,
        voltageL3: this.convert32BitSigned(pvVoltageL3.data) * 0.1,
        currentL1: this.convert32BitSigned(pvCurrentL1.data) * 0.01,
        currentL2: this.convert32BitSigned(pvCurrentL2.data) * 0.01,
        currentL3: this.convert32BitSigned(pvCurrentL3.data) * 0.01,
        energyToday: this.convert32BitUnsigned(pvEnergyToday.data) * 0.01,
        energyTotal: this.convert32BitUnsigned(pvEnergyTotal.data) * 0.1,
      };
    } catch (error) {
      console.error('Error reading PV data:', error.message);
      throw error;
    }
  }

  /**
   * Charge battery from grid
   */
  async chargeFromGrid(watts, targetSOC, durationSeconds) {
    if (!this.connected) {
      throw new Error('Not connected to Alpha ESS');
    }

    const powerValue = 32000 - watts;
    const socValue = Math.round(targetSOC / 0.4);

    console.log(`Charging at ${watts}W to ${targetSOC}% for ${durationSeconds}s`);

    // CRITICAL: Write in correct sequence
    await this.client.writeRegister(0x0880, 1); // Enable dispatch
    await this.write32BitValue(0x0881, powerValue); // Power
    await this.client.writeRegister(0x0886, socValue); // Target SOC
    await this.write32BitValue(0x0887, durationSeconds); // Duration
    await this.client.writeRegister(0x0885, 2); // Mode (MUST BE LAST!)

    return {
      success: true,
      mode: 'charging',
      watts,
      targetSOC,
      duration: durationSeconds,
    };
  }

  /**
   * Discharge battery to grid
   */
  async dischargeToGrid(watts, minimumSOC, durationSeconds) {
    if (!this.connected) {
      throw new Error('Not connected to Alpha ESS');
    }

    const powerValue = 32000 + watts;
    const socValue = Math.round(minimumSOC / 0.4);

    console.log(`Discharging at ${watts}W to ${minimumSOC}% for ${durationSeconds}s`);

    await this.client.writeRegister(0x0880, 1);
    await this.write32BitValue(0x0881, powerValue);
    await this.client.writeRegister(0x0886, socValue);
    await this.write32BitValue(0x0887, durationSeconds);
    await this.client.writeRegister(0x0885, 2); // MUST BE LAST!

    return {
      success: true,
      mode: 'discharging',
      watts,
      minimumSOC,
      duration: durationSeconds,
    };
  }

  /**
   * Prevent battery discharge to grid
   */
  async preventGridDischarge() {
    if (!this.connected) {
      throw new Error('Not connected to Alpha ESS');
    }

    console.log('Preventing grid discharge');

    await this.client.writeRegister(0x0880, 1);
    await this.write32BitValue(0x0881, 32000);
    await this.client.writeRegister(0x0886, 250);
    await this.write32BitValue(0x0887, 86400);
    await this.client.writeRegister(0x0885, 2);

    return {
      success: true,
      mode: 'grid_discharge_prevented',
    };
  }

  /**
   * Stop dispatch mode
   */
  async stopDispatch() {
    if (!this.connected) {
      throw new Error('Not connected to Alpha ESS');
    }

    console.log('Stopping dispatch mode');

    await this.client.writeRegister(0x0880, 0);

    return {
      success: true,
      mode: 'stopped',
    };
  }

  /**
   * Return to normal operation
   */
  async normalOperation() {
    return this.stopDispatch();
  }

  /**
   * Get dispatch configuration
   */
  async getDispatchConfig() {
    if (!this.connected) {
      throw new Error('Not connected to Alpha ESS');
    }

    try {
      const dispatchStart = await this.client.readHoldingRegisters(0x0880, 1);
      const power = await this.client.readHoldingRegisters(0x0881, 2);
      const mode = await this.client.readHoldingRegisters(0x0885, 1);
      const soc = await this.client.readHoldingRegisters(0x0886, 1);
      const time = await this.client.readHoldingRegisters(0x0887, 2);

      const powerValue = this.convert32BitUnsigned(power.data);
      const timeValue = this.convert32BitUnsigned(time.data);

      return {
        active: dispatchStart.data[0] === 1,
        mode: mode.data[0],
        power: powerValue,
        charging: powerValue < 32000,
        discharging: powerValue > 32000,
        watts: Math.abs(powerValue - 32000),
        targetSOC: soc.data[0] * 0.4,
        remainingSeconds: timeValue,
      };
    } catch (error) {
      console.error('Error reading dispatch config:', error.message);
      throw error;
    }
  }
}

export default AlphaESSController;