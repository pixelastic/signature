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
 * Adds signature images and text annotations to a PDF and downloads it
 *
 * @param {Uint8Array} pdfData - The original PDF as Uint8Array
 * @param {Array} signaturePlacements - Array of {image, x, y, pageIndex, scale}
 * @param {Array} textAnnotations - Array of text annotations
 * @param {object} pageDimensions - Map of pageIndex to {width, height}
 * @param {string} originalFileName - The original PDF filename
 */
export async function savePdfWithSignature(
  pdfData,
  signaturePlacements,
  textAnnotations,
  pageDimensions,
  originalFileName,
) {
  // Load the PDF
  const pdfDoc = await PDFDocument.load(pdfData);
  const pages = pdfDoc.getPages();

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
    if (!annotationPage) return;

    const dims = pageDimensions[annotation.pageIndex];
    if (!dims) return;

    const { width: pdfWidth, height: pdfHeight } = annotationPage.getSize();
    const scaleX = pdfWidth / dims.width;
    const scaleY = pdfHeight / dims.height;

    const font = fontMap[annotation.fontFamily] || fontMap.Helvetica;

    // Get text height to properly position baseline
    const textHeight = font.heightAtSize(annotation.fontSize);

    // Account for CSS padding (4px top, 8px left from .text-annotation-display)
    const paddingTop = 4;
    const paddingLeft = 8;

    // Convert viewport coordinates to PDF coordinates
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

  // Draw all signatures
  // Cache embedded images by data URL to avoid re-embedding duplicates
  const embeddedImages = {};
  for (const placement of signaturePlacements) {
    const sigPage = pages[placement.pageIndex];
    const dims = pageDimensions[placement.pageIndex];
    if (!sigPage || !dims) continue;

    const { width: pdfWidth, height: pdfHeight } = sigPage.getSize();
    const scaleX = pdfWidth / dims.width;
    const scaleY = pdfHeight / dims.height;

    if (!embeddedImages[placement.image]) {
      const signatureBytes = await dataUrlToArrayBuffer(placement.image);
      if (placement.image.startsWith('data:image/png')) {
        embeddedImages[placement.image] = await pdfDoc.embedPng(signatureBytes);
      } else if (
        placement.image.startsWith('data:image/jpeg') ||
        placement.image.startsWith('data:image/jpg')
      ) {
        embeddedImages[placement.image] = await pdfDoc.embedJpg(signatureBytes);
      } else {
        embeddedImages[placement.image] = await pdfDoc.embedPng(signatureBytes);
      }
    }
    const signatureImage = embeddedImages[placement.image];
    const signatureDims = signatureImage.scale(1);

    const maxWidth = 200 * placement.scale;
    const maxHeight = 100 * placement.scale;
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

    const pdfX = placement.x * scaleX;
    const pdfY = pdfHeight - placement.y * scaleY - signatureHeight * scaleY;

    sigPage.drawImage(signatureImage, {
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
