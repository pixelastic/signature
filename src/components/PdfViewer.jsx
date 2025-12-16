import { useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { DndContext, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { savePdfWithSignature } from '../utils/pdfManipulation.js';
import TextAnnotation from './TextAnnotation.jsx';
import './PdfViewer.css';

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/**
 *
 * @param root0
 * @param root0.signatureImage
 * @param root0.position
 */
function DraggableSignature({ signatureImage, position }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: 'signature',
  });

  const style = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: CSS.Translate.toString(transform),
    cursor: 'move',
    zIndex: 10,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <img
        src={signatureImage}
        alt="Signature"
        className="draggable-signature"
        draggable={false}
      />
    </div>
  );
}

/**
 *
 * @param root0
 * @param root0.pdfFile
 * @param root0.signatureImage
 * @param root0.signaturePosition
 * @param root0.onPositionChange
 * @param root0.textAnnotations
 * @param root0.onTextAnnotationsChange
 * @param root0.isAddingText
 * @param root0.onAddingTextChange
 * @param root0.textFontSize
 * @param root0.onTextFontSizeChange
 * @param root0.textFontFamily
 * @param root0.onTextFontFamilyChange
 */
function PdfViewer({
  pdfFile,
  signatureImage,
  signaturePosition,
  onPositionChange,
  textAnnotations,
  onTextAnnotationsChange,
  isAddingText,
  onAddingTextChange,
  textFontSize,
  onTextFontSizeChange,
  textFontFamily,
  onTextFontFamilyChange,
}) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef(null);
  const [pageWidth, setPageWidth] = useState(null);
  const [pageHeight, setPageHeight] = useState(null);

  /**
   *
   * @param root0
   * @param root0.numPages
   * @param input
   */
  function onDocumentLoadSuccess(input) {
    setNumPages(input.numPages);
  }

  /**
   *
   * @param page
   */
  function onPageLoadSuccess(page) {
    const viewport = page.getViewport({ scale: 1 });
    setPageWidth(viewport.width);
    setPageHeight(viewport.height);
  }

  /**
   *
   * @param event
   */
  function handleDragEnd(event) {
    const { delta, active } = event;

    if (active.id === 'signature') {
      onPositionChange({
        x: signaturePosition.x + delta.x,
        y: signaturePosition.y + delta.y,
      });
    } else {
      // Handle text annotation drag
      const annotationId = active.id;
      onTextAnnotationsChange(
        textAnnotations.map((annotation) =>
          annotation.id === annotationId
            ? {
                ...annotation,
                x: annotation.x + delta.x,
                y: annotation.y + delta.y,
              }
            : annotation,
        ),
      );
    }
  }

  /**
   *
   * @param event
   */
  function handlePdfClick(event) {
    if (!isAddingText) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const newAnnotation = {
      id: `text-${Date.now()}`,
      text: '',
      x,
      y,
      pageIndex: pageNumber - 1,
      fontSize: textFontSize,
      fontFamily: textFontFamily,
      isEditing: true,
    };

    onTextAnnotationsChange([...textAnnotations, newAnnotation]);
    onAddingTextChange(false);
  }

  /**
   *
   * @param updatedAnnotation
   */
  function handleTextUpdate(updatedAnnotation) {
    onTextAnnotationsChange(
      textAnnotations.map((annotation) =>
        annotation.id === updatedAnnotation.id ? updatedAnnotation : annotation,
      ),
    );
  }

  /**
   *
   * @param annotationId
   */
  function handleTextDelete(annotationId) {
    onTextAnnotationsChange(
      textAnnotations.filter((annotation) => annotation.id !== annotationId),
    );
  }

  /**
   *
   */
  async function handleExport() {
    if (!pdfFile || !pageWidth || !pageHeight) return;
    if (!signatureImage && textAnnotations.length === 0) {
      alert('Please add a signature or text annotations before exporting.');
      return;
    }

    setIsExporting(true);
    try {
      await savePdfWithSignature(
        pdfFile.uint8Array,
        signatureImage,
        signaturePosition,
        textAnnotations,
        pageNumber - 1,
        pageWidth,
        pageHeight,
        pdfFile.name,
      );
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error exporting PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-controls">
        <div className="page-controls">
          <button
            onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
            disabled={pageNumber <= 1}
          >
            Previous
          </button>
          <span>
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
            disabled={pageNumber >= numPages}
          >
            Next
          </button>
        </div>

        <div className="text-controls">
          <button
            onClick={() => onAddingTextChange(!isAddingText)}
            className={`add-text-button ${isAddingText ? 'active' : ''}`}
          >
            {isAddingText ? 'Cancel' : 'Add Text'}
          </button>

          <select
            value={textFontSize}
            onChange={(e) => onTextFontSizeChange(Number(e.target.value))}
            className="font-size-selector"
          >
            <option value={12}>12pt</option>
            <option value={14}>14pt</option>
            <option value={16}>16pt</option>
            <option value={18}>18pt</option>
            <option value={24}>24pt</option>
          </select>

          <select
            value={textFontFamily}
            onChange={(e) => onTextFontFamilyChange(e.target.value)}
            className="font-family-selector"
          >
            <option value="Helvetica">Helvetica</option>
            <option value="Courier">Courier</option>
            <option value="Times-Roman">Times Roman</option>
          </select>
        </div>

        <button
          onClick={handleExport}
          disabled={
            isExporting ||
            (!signatureImage && textAnnotations.length === 0)
          }
          className="export-button"
        >
          {isExporting ? 'Exporting...' : 'Download Signed PDF'}
        </button>
      </div>

      <div className="pdf-container" ref={containerRef}>
        <DndContext onDragEnd={handleDragEnd}>
          <div
            className={`pdf-page-wrapper ${isAddingText ? 'adding-text' : ''}`}
            onClick={handlePdfClick}
          >
            <Document
              file={pdfFile.arrayBuffer}
              onLoadSuccess={onDocumentLoadSuccess}
              className="pdf-document"
            >
              <Page
                pageNumber={pageNumber}
                onLoadSuccess={onPageLoadSuccess}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
            {signatureImage && (
              <DraggableSignature
                signatureImage={signatureImage}
                position={signaturePosition}
              />
            )}
            {textAnnotations
              .filter(
                (annotation) => annotation.pageIndex === pageNumber - 1,
              )
              .map((annotation) => (
                <TextAnnotation
                  key={annotation.id}
                  annotation={annotation}
                  onUpdate={handleTextUpdate}
                  onDelete={handleTextDelete}
                />
              ))}
          </div>
        </DndContext>
      </div>
    </div>
  );
}

export default PdfViewer;
