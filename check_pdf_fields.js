import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

// The fillable PDF content from document 2 needs to be saved
// For now, let's check if we can extract field info from the PDF

(async () => {
  try {
    console.log('Checking PDF at: ./public/ar1_fillable.pdf');

    const pdfBytes = fs.readFileSync('./public/ar1_fillable.pdf');
    console.log('PDF size:', pdfBytes.length, 'bytes');
    console.log('First 10 bytes:', Array.from(pdfBytes.slice(0, 10)));

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    console.log('\n✅ Total fields found:', fields.length);
    console.log('\n📋 Field names and types:');
    fields.forEach((field, index) => {
      const name = field.getName();
      const type = field.constructor.name;
      console.log(`  ${index + 1}. "${name}" (${type})`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();
