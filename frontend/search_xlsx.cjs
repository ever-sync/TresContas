const XLSX = require('xlsx');

const filePath = process.argv[2];
const keywords = ['RECEITA BRUTA', 'DEDUÇÕES', 'CUSTO', 'DESPESA', 'ADMINISTRATIVA', 'COMERCIAL', 'FINANCEIRA', 'TRIBUTARIA', 'DEPRECIAÇÃO'];

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    keywords.forEach(kw => {
        console.log(`--- Buscando por: ${kw} ---`);
        data.forEach(row => {
            const rowStr = row.join(' ');
            if (rowStr.toUpperCase().includes(kw)) {
                console.log(row.slice(0, 5).join(' | '));
            }
        });
    });
} catch (error) {
    console.error('Erro:', error.message);
}
