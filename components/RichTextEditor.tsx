'use client'

import { useState, useRef, useEffect } from 'react'
import { Bold, Italic, List, ListOrdered } from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
}

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = 'Écrivez votre commentaire...', 
  minHeight = '150px' 
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (editorRef.current && !isFocused && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value
    }
  }, [value, isFocused])

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleInput()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+B pour gras
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault()
      execCommand('bold')
    }
    // Ctrl+I pour italique
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault()
      execCommand('italic')
    }
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${isFocused ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-600'}`}>
      {/* Barre d'outils */}
      <div className="bg-slate-800 border-b border-gray-600 p-2 flex gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="p-2 hover:bg-slate-700 rounded transition flex items-center justify-center"
          title="Gras (Ctrl+B)"
        >
          <Bold size={18} className="text-gray-300" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="p-2 hover:bg-slate-700 rounded transition flex items-center justify-center"
          title="Italique (Ctrl+I)"
        >
          <Italic size={18} className="text-gray-300" />
        </button>
        <div className="w-px bg-gray-600 mx-1"></div>
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="p-2 hover:bg-slate-700 rounded transition flex items-center justify-center"
          title="Liste à puces"
        >
          <List size={18} className="text-gray-300" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className="p-2 hover:bg-slate-700 rounded transition flex items-center justify-center"
          title="Liste numérotée"
        >
          <ListOrdered size={18} className="text-gray-300" />
        </button>
      </div>

      {/* Zone d'édition */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        className="p-4 bg-slate-900 text-white focus:outline-none prose prose-invert max-w-none"
        style={{ minHeight }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #6b7280;
          pointer-events: none;
          display: block;
        }
        [contenteditable] {
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        [contenteditable] b, [contenteditable] strong {
          font-weight: bold;
        }
        [contenteditable] i, [contenteditable] em {
          font-style: italic;
        }
        [contenteditable] ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        [contenteditable] ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        [contenteditable] li {
          margin: 0.25rem 0;
        }
      `}</style>
    </div>
  )
}