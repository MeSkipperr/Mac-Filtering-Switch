const { Client } = require('ssh2');
const fs = require('fs');

const remoteHost = '10.10.10.25';
const password = '';
const clientPort = 8; // You can adjust this value as needed

const runSSHCommands = async () => {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        let configurations = ''; // To store the configurations

        conn
            .on('ready', () => {
                console.log('SSH Connection ready');

                // Loop through ports 1 to 8
                let portIndex = 1;
                const macAddresses = {}; // To store MAC addresses for each port

                const loopPorts = async () => {
                    if (portIndex > 8) {
                        conn.end();

                        // Create the configuration string with clientPort

                        let portRange = '1/1/1-1/1/' + clientPort;

                        let configText = `interface ${portRange}
port-access port-security client-limit ${clientPort}
`;

                        // Add port-access port-security mac-address for each port
                        for (let i = 1; i <= 8; i++) {
                            const macAddress = macAddresses[`1/1/${i}`];
                            if (macAddress) {
                                configText += `port-access port-security mac-address ${macAddress}
`;
                            }
                        }

                        configText += `port-access port-security enable
exit
`;

                        configurations += configText;

                        // Write the configurations to a file
                        fs.writeFileSync('port_configurations.txt', configurations);
                        console.log('Configurations written to port_configurations.txt');
                        return resolve();
                    }

                    const portVariable = `1/1/${portIndex}`;
                    console.log(`Getting MAC address for port: ${portVariable}`);

                    // Get MAC Address for the current port
                    conn.exec(`show mac-address-table port ${portVariable}`, (err, stream) => {
                        if (err) return reject(err);

                        let output = '';
                        stream
                            .on('data', (data) => {
                                output += data.toString();
                            })
                            .on('close', () => {
                                const macRegex = /([0-9a-f]{2}[:-]){5}([0-9a-f]{2})/i;
                                const match = output.match(macRegex);

                                if (match) {
                                    const macAddress = match[0];
                                    console.log(`MAC Address for ${portVariable}:`, macAddress);

                                    // Store the MAC address for the current port
                                    macAddresses[portVariable] = macAddress;

                                    // Proceed to the next port
                                    portIndex++;
                                    loopPorts();
                                } else {
                                    console.error('MAC Address not found for port:', portVariable);
                                    portIndex++;
                                    loopPorts(); // Skip to next port
                                }
                            })
                            .stderr.on('data', (data) => {
                                console.error('STDERR (show mac-address-table):', data.toString());
                            });
                    });
                };

                loopPorts(); // Start the loop
            })
            .on('error', (err) => {
                console.error('Connection error:', err);
                reject(err);
            })
            .connect({
                host: remoteHost,
                port: 22,
                username: 'admin',
                password,
                readyTimeout: 20000,
            });
    });
};

(async () => {
    try {
        await runSSHCommands();
        console.log('Configuration completed successfully.');
    } catch (error) {
        console.error('Error:', error);
    }
})();
