const fs = require('fs');
// Input data - replace with your actual input mechanism (file, API, etc.)
const inputData = fs.readFileSync('requests.log', 'utf8');

// Function to process the data
function concatenateBalances(input) {
    // Split the input by new lines
    const lines = input.trim().split('\n');

    // Initialize the result object with an empty balances array
    const result = {
        balances: []
    };

    // Process each line
    lines.forEach(line => {
        // Extract the JSON part (after the timestamp and dash)
        const jsonPart = line.split(' - ')[1];

        try {
            // Parse the JSON
            const data = JSON.parse(jsonPart);

            // Add each balance object to our result array
            if (data.balances && Array.isArray(data.balances)) {
                result.balances.push(...data.balances);
            }
        } catch (error) {
            console.error('Error parsing JSON:', error);
        }
    });

    return result;
}

// Process the data
const combinedData = concatenateBalances(inputData);

// Output the result
console.log(JSON.stringify(combinedData, null, 2));