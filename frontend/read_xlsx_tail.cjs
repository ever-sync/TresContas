const XLSX = require('xlsx');

const filePath = process.argv[2];
if (!filePath) {
    console.error('Por favor, forneça o caminho do arquivo.');
    process.exit(1);
}

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const last100 = data.slice(-100);
    last100.forEach(row => console.log(row.join(',')));
} catch (error) {
    console.error('Erro ao ler o arquivo:', error.message);
}
