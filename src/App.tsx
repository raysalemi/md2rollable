import { useState, useCallback, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { emacs } from '@replit/codemirror-emacs';
import { compileShorthand, decompileToShorthand } from './compiler';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';

interface SavedBlock {
  title: string;
  content: string;
}

function App() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [title, setTitle] = useState('');
  const [savedBlocks, setSavedBlocks] = useState<SavedBlock[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);

  // Load saved blocks on mount
  useEffect(() => {
    const saved = localStorage.getItem('dnd-blocks');
    if (saved) {
      setSavedBlocks(JSON.parse(saved));
    }
  }, []);

  const handleSave = () => {
    if (!title.trim() || !input.trim()) return;
    const block = { title: title.trim(), content: input };
    const newBlocks = [...savedBlocks.filter(b => b.title !== block.title), block];
    setSavedBlocks(newBlocks);
    localStorage.setItem('dnd-blocks', JSON.stringify(newBlocks));
  };

  const handleLoad = (block: SavedBlock) => {
    setTitle(block.title);
    setInput(block.content);
    setShowSidebar(false);
  };

  const handleDelete = (titleToDelete: string) => {
    const newBlocks = savedBlocks.filter(b => b.title !== titleToDelete);
    setSavedBlocks(newBlocks);
    localStorage.setItem('dnd-blocks', JSON.stringify(newBlocks));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
  };

  // Compile to output whenever input changes
  useEffect(() => {
    setOutput(compileShorthand(input));
  }, [input]);

  const onChange = useCallback((val: string) => {
    // Magic Decompilation: If valid D&D Beyond tags are pasted or typed, instantly convert them to shorthand
    if (val.includes('[rollable]') || val.includes('[spell]')) {
      const decompiled = decompileToShorthand(val);
      if (decompiled !== val) {
        setInput(decompiled);
        return;
      }
    }
    setInput(val);
  }, []);

  return (
    <div className="flex h-screen bg-bg-base text-gray-200 overflow-hidden font-sans">
      
      {/* Sidebar (Storage) */}
      <div className={`${showSidebar ? 'w-64 border-r border-gray-700' : 'w-0'} transition-all duration-300 flex flex-col bg-bg-surface overflow-hidden`}>
        <div className="p-4 flex justify-between items-center border-b border-gray-700">
          <h2 className="font-bold text-gray-300">Saved Blocks</h2>
          <button onClick={() => setShowSidebar(false)} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {savedBlocks.length === 0 && (
            <p className="text-gray-500 text-sm p-2">No saved blocks yet.</p>
          )}
          {savedBlocks.map(b => (
            <div key={b.title} className="flex justify-between items-center p-2 rounded hover:bg-bg-surface-elevated group">
              <button onClick={() => handleLoad(b)} className="text-left flex-1 truncate text-gray-300 hover:text-white">
                {b.title}
              </button>
              <button onClick={() => handleDelete(b.title)} className="text-red-500 opacity-0 group-hover:opacity-100 px-2 hover:text-red-400">
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-bg-surface border-b border-gray-700 flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-gray-400 hover:text-primary transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-xl font-bold text-primary tracking-wide">D&D Beyond Compiler</h1>
          </div>
          <div className="flex items-center space-x-4">
            <input 
              type="text" 
              placeholder="Block Title..." 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-bg-base border border-gray-700 rounded px-3 py-1 text-sm focus:outline-none focus:border-primary text-gray-200"
            />
            <button 
              onClick={handleSave}
              className="bg-bg-surface-elevated hover:bg-gray-600 text-gray-200 px-4 py-1.5 rounded text-sm font-medium transition-colors"
            >
              Save Block
            </button>
          </div>
        </header>

        {/* Editor Split Pane */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Pane: Shorthand Input */}
          <div className="flex-1 flex flex-col border-r border-gray-700 bg-bg-base">
            <div className="h-10 bg-bg-surface-elevated flex items-center px-4 justify-between shadow-sm">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Shorthand Input (Emacs)</span>
              <span className="text-xs text-gray-500">[[hit: +X]], [[dmg: 1d8, type]], [[spell: name]]</span>
            </div>
            <div className="flex-1 overflow-auto bg-[#1e1e1e]">
              <CodeMirror
                value={input}
                theme={vscodeDark}
                extensions={[markdown({ base: markdownLanguage }), emacs()]}
                onChange={onChange}
                className="h-full text-sm"
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLineGutter: true,
                  foldGutter: true,
                }}
              />
            </div>
          </div>

          {/* Right Pane: JSON Output */}
          <div className="flex-1 flex flex-col bg-bg-base relative">
            <div className="h-10 bg-bg-surface-elevated flex items-center px-4 justify-between shadow-sm">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Output (D&D Beyond Code)</span>
              <button 
                onClick={handleCopy}
                className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1 rounded transition-colors"
              >
                Copy to Clipboard
              </button>
            </div>
            <div className="flex-1 p-4 overflow-auto">
              <pre className="font-mono text-sm text-gray-300 whitespace-pre-wrap break-words">
                {output || <span className="text-gray-600 italic">Output will appear here...</span>}
              </pre>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
