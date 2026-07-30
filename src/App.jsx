import { useState } from 'react';
import PdfUploader from './components/PdfUploader.jsx';
import SignatureUploader from './components/SignatureUploader.jsx';
import PdfViewer from './components/PdfViewer.jsx';
import './App.css';

/**
 *
 */
function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [signatureImage, setSignatureImage] = useState(null);
  const [signatures, setSignatures] = useState([]);
  const [textAnnotations, setTextAnnotations] = useState([]);
  const [isAddingText, setIsAddingText] = useState(false);
  const [textFontSize, setTextFontSize] = useState(14);
  const [textFontFamily, setTextFontFamily] = useState('Helvetica');

  function handleSignatureLoad(dataUrl) {
    setSignatureImage(dataUrl);
    setSignatures((prev) => [
      ...prev,
      {
        id: `sig-${Date.now()}`,
        image: dataUrl,
        position: { x: 50, y: 50 },
        pageIndex: 0,
        scale: 1,
      },
    ]);
  }

  function handleSignatureUpdate(id, changes) {
    setSignatures((prev) =>
      prev.map((sig) => (sig.id === id ? { ...sig, ...changes } : sig)),
    );
  }

  function handleSignatureDelete(id) {
    setSignatures((prev) => prev.filter((sig) => sig.id !== id));
  }

  function handleSignatureDuplicate(id) {
    setSignatures((prev) => {
      const source = prev.find((sig) => sig.id === id);
      if (!source) return prev;
      return [
        ...prev,
        {
          ...source,
          id: `sig-${Date.now()}`,
          position: { x: source.position.x + 20, y: source.position.y + 20 },
        },
      ];
    });
  }

  return (
    <div className="app">
      <header className="header">
        <h1>PDF Signature Tool</h1>
        <p>Add your signature to PDF documents - 100% client-side</p>
      </header>

      <main className="main-content">
        <div className="upload-section">
          <PdfUploader onPdfLoad={setPdfFile} />
          <SignatureUploader onSignatureLoad={handleSignatureLoad} />
        </div>

        {pdfFile && (
          <PdfViewer
            pdfFile={pdfFile}
            signatureImage={signatureImage}
            signatures={signatures}
            onSignatureUpdate={handleSignatureUpdate}
            onSignatureDelete={handleSignatureDelete}
            onSignatureDuplicate={handleSignatureDuplicate}
            textAnnotations={textAnnotations}
            onTextAnnotationsChange={setTextAnnotations}
            isAddingText={isAddingText}
            onAddingTextChange={setIsAddingText}
            textFontSize={textFontSize}
            onTextFontSizeChange={setTextFontSize}
            textFontFamily={textFontFamily}
            onTextFontFamilyChange={setTextFontFamily}
          />
        )}

        {!pdfFile && (
          <div className="placeholder">
            <p>Upload a PDF to get started</p>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>
          Made by{' '}
          <a
            href="https://bsky.app/profile/pixelastic.bsky.social"
            target="_blank"
            rel="noopener noreferrer"
          >
            pixelastic
          </a>
          {' · '}
          <a
            href="https://github.com/pixelastic/signature"
            target="_blank"
            rel="noopener noreferrer"
          >
            Code available on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
