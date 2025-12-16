import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Converts a data URL to an array buffer
 * @param dataUrl
 */
async function dataUrlToArrayBuffer(dataUrl) {
  const response = await fetch(dataUrl);
  return response.arrayBuffer();
}

/**
 * Adds a signature image and text annotations to a PDF and downloads it
 *
 * @param {Uint8Array} pdfData - The original PDF as Uint8Array
 * @param {string} signatureDataUrl - The signature image as data URL
 * @param {object} position - The position {x, y} in viewport coordinates
 * @param {Array} textAnnotations - Array of text annotations
 * @param {number} pageIndex - The page index (0-based)
 * @param {number} pageWidth - The rendered page width
 * @param {number} pageHeight - The rendered page height
 * @param {string} originalFileName - The original PDF filename
 */
export async function savePdfWithSignature(
  pdfData,
  signatureDataUrl,
  position,
  textAnnotations,
  pageIndex,
  pageWidth,
  pageHeight,
  originalFileName,
) {
  // Load the PDF
  const pdfDoc = await PDFDocument.load(pdfData);

  // Get the page
  const pages = pdfDoc.getPages();
  const page = pages[pageIndex];

  // Get actual PDF page dimensions
  const { width: pdfWidth, height: pdfHeight } = page.getSize();

  // Coordinate conversion scales
  const scaleX = pdfWidth / pageWidth;
  const scaleY = pdfHeight / pageHeight;

  // Embed fonts for text annotations
  const fontMap = {};
  const uniqueFonts = [...new Set(textAnnotations.map((a) => a.fontFamily))];

  for (const fontFamily of uniqueFonts) {
    let standardFont;
    if (fontFamily === 'Courier') {
      standardFont = StandardFonts.Courier;
    } else if (fontFamily === 'Times-Roman') {
      standardFont = StandardFonts.TimesRoman;
    } else {
      standardFont = StandardFonts.Helvetica;
    }
    fontMap[fontFamily] = await pdfDoc.embedFont(standardFont);
  }

  // Draw text annotations on all pages
  textAnnotations.forEach((annotation) => {
    const annotationPage = pages[annotation.pageIndex];
    const font = fontMap[annotation.fontFamily] || fontMap.Helvetica;

    // Get text height to properly position baseline
    const textHeight = font.heightAtSize(annotation.fontSize);

    // Account for CSS padding (4px top, 8px left from .text-annotation-display)
    const paddingTop = 4;
    const paddingLeft = 8;

    // Convert viewport coordinates to PDF coordinates
    // In viewport: y is top of text box, x is left of text box
    // In PDF: y is baseline of text, x is left of text
    // We need to add padding and subtract text height
    const pdfX = (annotation.x + paddingLeft) * scaleX;
    const pdfY = pdfHeight - (annotation.y + paddingTop) * scaleY - textHeight;

    annotationPage.drawText(annotation.text, {
      x: pdfX,
      y: pdfY,
      size: annotation.fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  });

  // Draw signature if provided
  if (signatureDataUrl) {
    const signatureBytes = await dataUrlToArrayBuffer(signatureDataUrl);
    let signatureImage;

    if (signatureDataUrl.startsWith('data:image/png')) {
      signatureImage = await pdfDoc.embedPng(signatureBytes);
    } else if (
      signatureDataUrl.startsWith('data:image/jpeg') ||
      signatureDataUrl.startsWith('data:image/jpg')
    ) {
      signatureImage = await pdfDoc.embedJpg(signatureBytes);
    } else {
      // Default to PNG for other formats
      signatureImage = await pdfDoc.embedPng(signatureBytes);
    }

    const signatureDims = signatureImage.scale(1);

    // Calculate signature dimensions (max 200x100 as in CSS)
    const maxWidth = 200;
    const maxHeight = 100;
    let signatureWidth = signatureDims.width;
    let signatureHeight = signatureDims.height;

    if (signatureWidth > maxWidth) {
      signatureHeight = (maxWidth / signatureWidth) * signatureHeight;
      signatureWidth = maxWidth;
    }
    if (signatureHeight > maxHeight) {
      signatureWidth = (maxHeight / signatureHeight) * signatureWidth;
      signatureHeight = maxHeight;
    }

    // Convert viewport coordinates to PDF coordinates
    const pdfX = position.x * scaleX;
    const pdfY = pdfHeight - position.y * scaleY - signatureHeight * scaleY;

    // Draw the signature on the page
    page.drawImage(signatureImage, {
      x: pdfX,
      y: pdfY,
      width: signatureWidth * scaleX,
      height: signatureHeight * scaleY,
    });
  }

  // Save the PDF
  const pdfBytes = await pdfDoc.save();

  // Create a blob and download
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;

  // Generate output filename
  const fileNameWithoutExt = originalFileName.replace(/\.pdf$/i, '');
  link.download = `${fileNameWithoutExt}-signed.pdf`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up
  URL.revokeObjectURL(url);
}
