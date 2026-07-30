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
 * @param root0.id
 * @param root0.signatureImage
 * @param root0.position
 * @param root0.scale
 * @param root0.selected
 * @param root0.onDelete
 * @param root0.onDuplicate
 * @param root0.onScaleChange
 */
function DraggableSignature({
  id,
  signatureImage,
  position,
  scale,
  selected,
  onDelete,
  onDuplicate,
  onScaleChange,
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
  });

  const style = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: CSS.Translate.toString(transform),
    cursor: 'move',
    zIndex: 10,
  };

  /**
   *
   * @param e
   */
  function handleResizePointerDown(e) {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startScale = scale;

    /**
     *
     * @param moveEvent
     */
    function onPointerMove(moveEvent) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const diagonal = (dx + dy) / 2;
      const newScale = Math.max(0.3, Math.min(5, startScale + diagonal / 100));
      onScaleChange(newScale);
    }

    /**
     *
     */
    function onPointerUp() {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`signature-wrapper ${selected ? 'selected' : ''}`}
      {...listeners}
      {...attributes}
    >
      <img
        src={signatureImage}
        alt="Signature"
        className="draggable-signature"
        style={{
          maxWidth: `${200 * scale}px`,
          maxHeight: `${100 * scale}px`,
        }}
        draggable={false}
      />
      {selected && (
        <>
          <button
            className="signature-delete-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete signature"
          >
            ×
          </button>
          <button
            className="signature-duplicate-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            title="Duplicate signature"
          >
            +
          </button>
          <div
            className="signature-resize-handle"
            onPointerDown={handleResizePointerDown}
          />
        </>
      )}
    </div>
  );
}

/**
 *
 * @param root0
 * @param root0.pdfFile
 * @param root0.signatureImage
 * @param root0.signatures
 * @param root0.onSignatureUpdate
 * @param root0.onSignatureDelete
 * @param root0.onSignatureDuplicate
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
  signatures,
  onSignatureUpdate,
  onSignatureDelete,
  onSignatureDuplicate,
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
  const [isExporting, setIsExporting] = useState(false);
  const [pageDimensions, setPageDimensions] = useState({});
  const [selectedSignatureId, setSelectedSignatureId] = useState(null);
  const containerRef = useRef(null);
  const pageRefs = useRef({});

  /**
   *
   * @param input
   */
  function onDocumentLoadSuccess(input) {
    setNumPages(input.numPages);
  }

  /**
   *
   * @param page
   * @param pageIndex
   */
  function handlePageLoadSuccess(page, pageIndex) {
    const viewport = page.getViewport({ scale: 1 });
    setPageDimensions((prev) => ({
      ...prev,
      [pageIndex]: { width: viewport.width, height: viewport.height },
    }));
  }

  /**
   *
   * @param event
   */
  function handleDragEnd(event) {
    const { delta, active, activatorEvent } = event;

    const sig = signatures.find((s) => s.id === active.id);
    if (sig) {
      // Treat as click if barely moved
      if (Math.abs(delta.x) < 3 && Math.abs(delta.y) < 3) {
        setSelectedSignatureId((prev) =>
          prev === sig.id ? null : sig.id,
        );
        return;
      }
      setSelectedSignatureId(null);

      // Detect target page from pointer position
      const pointerY = activatorEvent.clientY + delta.y;
      let targetPageIndex = sig.pageIndex;
      for (let i = 0; i < numPages; i++) {
        const el = pageRefs.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (pointerY >= rect.top && pointerY <= rect.bottom) {
          targetPageIndex = i;
          break;
        }
      }

      if (targetPageIndex !== sig.pageIndex) {
        const srcRect =
          pageRefs.current[sig.pageIndex].getBoundingClientRect();
        const tgtRect =
          pageRefs.current[targetPageIndex].getBoundingClientRect();
        onSignatureUpdate(sig.id, {
          pageIndex: targetPageIndex,
          position: {
            x: sig.position.x + delta.x - (tgtRect.left - srcRect.left),
            y: sig.position.y + delta.y - (tgtRect.top - srcRect.top),
          },
        });
      } else {
        onSignatureUpdate(sig.id, {
          position: {
            x: sig.position.x + delta.x,
            y: sig.position.y + delta.y,
          },
        });
      }
      return;
    }

    // Text annotation drag
    onTextAnnotationsChange(
      textAnnotations.map((annotation) =>
        annotation.id === active.id
          ? {
              ...annotation,
              x: annotation.x + delta.x,
              y: annotation.y + delta.y,
            }
          : annotation,
      ),
    );
  }

  /**
   *
   * @param e
   * @param pageIndex
   */
  function handlePageClick(e, pageIndex) {
    // Don't handle clicks on signature or its children
    if (e.target.closest('.signature-wrapper')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isAddingText) {
      const newAnnotation = {
        id: `text-${Date.now()}`,
        text: '',
        x,
        y,
        pageIndex,
        fontSize: textFontSize,
        fontFamily: textFontFamily,
        isEditing: true,
      };
      onTextAnnotationsChange([...textAnnotations, newAnnotation]);
      onAddingTextChange(false);
      return;
    }

    // Deselect signature when clicking elsewhere
    setSelectedSignatureId(null);
  }

  /**
   *
   * @param updatedAnnotation
   */
  function handleTextUpdate(updatedAnnotation) {
    onTextAnnotationsChange(
      textAnnotations.map((annotation) =>
        annotation.id === updatedAnnotation.id
          ? updatedAnnotation
          : annotation,
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
  function handleSignatureDelete(id) {
    onSignatureDelete(id);
    setSelectedSignatureId(null);
  }

  /**
   *
   */
  async function handleExport() {
    if (!pdfFile || Object.keys(pageDimensions).length === 0) return;
    if (signatures.length === 0 && textAnnotations.length === 0) {
      alert('Please add a signature or text annotations before exporting.');
      return;
    }

    setIsExporting(true);
    try {
      const signaturePlacements = signatures.map((sig) => ({
        image: sig.image,
        x: sig.position.x,
        y: sig.position.y,
        pageIndex: sig.pageIndex,
        scale: sig.scale,
      }));

      await savePdfWithSignature(
        pdfFile.uint8Array,
        signaturePlacements,
        textAnnotations,
        pageDimensions,
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
            (signatures.length === 0 && textAnnotations.length === 0)
          }
          className="export-button"
        >
          {isExporting ? 'Exporting...' : 'Download Signed PDF'}
        </button>
      </div>

      <div className="pdf-container" ref={containerRef}>
        <DndContext onDragEnd={handleDragEnd}>
          <Document
            file={pdfFile.arrayBuffer}
            onLoadSuccess={onDocumentLoadSuccess}
            className="pdf-document"
          >
            {numPages &&
              Array.from({ length: numPages }, (_, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    pageRefs.current[i] = el;
                  }}
                  className={`pdf-page-wrapper ${isAddingText ? 'adding-text' : ''}`}
                  onClick={(e) => handlePageClick(e, i)}
                >
                  <Page
                    pageNumber={i + 1}
                    onLoadSuccess={(page) => handlePageLoadSuccess(page, i)}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                  {signatures
                    .filter((sig) => sig.pageIndex === i)
                    .map((sig) => (
                      <DraggableSignature
                        key={sig.id}
                        id={sig.id}
                        signatureImage={sig.image}
                        position={sig.position}
                        scale={sig.scale}
                        selected={selectedSignatureId === sig.id}
                        onDelete={() => handleSignatureDelete(sig.id)}
                        onDuplicate={() => onSignatureDuplicate(sig.id)}
                        onScaleChange={(newScale) =>
                          onSignatureUpdate(sig.id, { scale: newScale })
                        }
                      />
                    ))}
                  {textAnnotations
                    .filter((annotation) => annotation.pageIndex === i)
                    .map((annotation) => (
                      <TextAnnotation
                        key={annotation.id}
                        annotation={annotation}
                        onUpdate={handleTextUpdate}
                        onDelete={handleTextDelete}
                      />
                    ))}
                  <div className="page-number-label">
                    Page {i + 1} / {numPages}
                  </div>
                </div>
              ))}
          </Document>
        </DndContext>
      </div>
    </div>
  );
}

export default PdfViewer;
