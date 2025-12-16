import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import './TextAnnotation.css';

/**
 *
 * @param root0
 * @param root0.annotation
 * @param root0.onUpdate
 * @param root0.onDelete
 */
function TextAnnotation({ annotation, onUpdate, onDelete }) {
  const [inputValue, setInputValue] = useState(annotation.text);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: annotation.id,
  });

  const style = {
    position: 'absolute',
    left: `${annotation.x}px`,
    top: `${annotation.y}px`,
    transform: CSS.Translate.toString(transform),
    fontSize: `${annotation.fontSize}px`,
    fontFamily: annotation.fontFamily,
    zIndex: 10,
  };

  /**
   *
   * @param text
   */
  function handleFinish(text) {
    if (!text.trim()) {
      onDelete(annotation.id);
      return;
    }
    onUpdate({ ...annotation, text, isEditing: false });
  }

  /**
   *
   * @param e
   */
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFinish(inputValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (!annotation.text.trim()) {
        onDelete(annotation.id);
      } else {
        onUpdate({ ...annotation, isEditing: false });
      }
    }
  }

  if (annotation.isEditing) {
    return (
      <div style={style}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={() => handleFinish(inputValue)}
          onKeyDown={handleKeyDown}
          className="text-annotation-input"
          autoFocus
          style={{
            fontSize: `${annotation.fontSize}px`,
            fontFamily: annotation.fontFamily,
          }}
        />
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <div className="text-annotation-display">
        {annotation.text}
        <button
          className="text-annotation-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(annotation.id);
          }}
          title="Delete"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default TextAnnotation;
