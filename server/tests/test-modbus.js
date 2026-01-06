// test-modbus.js
import ModbusRTU from 'modbus-serial';

// Test both IPs
const IPS_TO_TEST = [
  { name: 'Ethernet', ip: '192.168.1.158' },
  { name: 'WiFi', ip: '192.168.1.179' }
];

const PORT = 502;
const SLAVE_ID = 85;

async function testIP(name, ip) {
  const client = new ModbusRTU();
  
  console.log(`\n========================================`);
  console.log(`Testing ${name}: ${ip}`);
  console.log(`========================================\n`);
  
  try {
    console.log('🔄 Connecting...');
    await client.connectTCP(ip, { port: PORT });
    console.log('✅ TCP connection established!\n');
    
    client.setID(SLAVE_ID);
    client.setTimeout(5000);
    
    console.log('📊 Reading battery data...\n');
    
    // Read Battery SOC
    const socData = await client.readHoldingRegisters(0x0102, 1);
    const soc = socData.data[0];
    console.log(`   Battery SOC: ${soc}%`);
    
    // Read Battery Voltage
    const voltageData = await client.readHoldingRegisters(0x0100, 1);
    const voltage = voltageData.data[0] * 0.1;
    console.log(`   Battery Voltage: ${voltage.toFixed(1)}V`);
    
    // Read Battery Power
    const powerData = await client.readHoldingRegisters(0x0103, 2);
    let power = (powerData.data[0] << 16) | powerData.data[1];
    if (power > 0x7FFFFFFF) power -= 0x100000000;
    console.log(`   Battery Power: ${power}W`);
    
    // Read Grid Power
    const gridData = await client.readHoldingRegisters(0x0470, 2);
    let gridPower = (gridData.data[0] << 16) | gridData.data[1];
    if (gridPower > 0x7FFFFFFF) gridPower -= 0x100000000;
    console.log(`   Grid Power: ${gridPower}W`);
    
    // Read PV Power
    const pvData = await client.readHoldingRegisters(0x048A, 1);
    const pvPower = pvData.data[0];
    console.log(`   PV Power: ${pvPower}W`);
    
    console.log(`\n🎉 SUCCESS! ${name} (${ip}) IS WORKING!`);
    console.log(`📊 Battery: ${soc}% | ${voltage.toFixed(1)}V | ${power}W`);
    console.log(`⚡ Solar: ${pvPower}W | Grid: ${gridPower}W\n`);
    
    client.close(() => {});
    return true;
    
  } catch (error) {
    console.log(`❌ ${name} FAILED: ${error.message}\n`);
    return false;
  }
}

async function runTests() {
  console.log('\n🔌 Alpha ESS Modbus Connection Test');
  console.log('Testing both WiFi and Ethernet connections...\n');
  
  let workingConnection = null;
  
  for (const connection of IPS_TO_TEST) {
    const success = await testIP(connection.name, connection.ip);
    if (success && !workingConnection) {
      workingConnection = connection;
    }
  }
  
  console.log('\n========================================');
  console.log('RESULTS:');
  console.log('========================================\n');
  
  if (workingConnection) {
    console.log(`✅ Use ${workingConnection.name} connection: ${workingConnection.ip}`);
    console.log(`\n📝 Update your .env file:`);
    console.log(`ALPHA_ESS_IP=${workingConnection.ip}`);
    console.log(`ALPHA_ESS_PORT=502`);
    console.log(`ALPHA_ESS_SLAVE_ID=85\n`);
  } else {
    console.log('❌ Neither connection worked.');
    console.log('\nPossible reasons:');
    console.log('1. Modbus TCP is not enabled on the inverter');
    console.log('2. Firewall is blocking port 502');
    console.log('3. Wrong slave ID (try 0x55 = 85 decimal)');
    console.log('\n📞 Contact your installer on Monday to enable Modbus TCP\n');
  }
}

runTests();