const XLSX = require('xlsx');

const filePath = process.argv[2];
try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log("Searching for Class 4 rows with values...");
    let found = 0;
    data.forEach(row => {
        if (typeof row[0] === 'string' && row[0].startsWith('04.')) {
            // Check if column 2 is a number (Value)
            // In the "Values" section, Col 2 was Jan value
            if (typeof row[2] === 'number') {
                if (found < 5) console.log(row.join(','));
                found++;
            }
        }
    });
    console.log(`Total 04. rows with values: ${found}`);

    console.log("\nSearching for Class 3 rows with values...");
    found = 0;
    data.forEach(row => {
        if (typeof row[0] === 'string' && row[0].startsWith('03.')) {
            if (typeof row[2] === 'number') {
                if (found < 5) console.log(row.join(','));
                found++;
            }
        }
    });
    console.log(`Total 03. rows with values: ${found}`);

} catch (e) {
    console.log(e);
}
