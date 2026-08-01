import { useState, useCallback, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { emacs } from '@replit/codemirror-emacs';
import { EditorView } from '@codemirror/view';
import { compileShorthand, decompileToShorthand } from './compiler';
import { solarizedLight } from '@uiw/codemirror-theme-solarized';

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

  useEffect(() => {
    setOutput(compileShorthand(input));
  }, [input]);

  const onChange = useCallback((val: string) => {
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
    <div className="flex h-screen bg-solar-base3 text-solar-base02 overflow-hidden font-sans">
      
      {/* Sidebar (Storage) */}
      <div className={`${showSidebar ? 'w-64 border-r border-solar-base1/30' : 'w-0'} transition-all duration-300 flex flex-col bg-solar-base2 overflow-hidden shadow-xl z-10`}>
        <div className="p-4 flex justify-between items-center border-b border-solar-base1/30">
          <h2 className="font-bold text-solar-base03">Saved Blocks</h2>
          <button onClick={() => setShowSidebar(false)} className="text-solar-base0 hover:text-solar-red text-xl">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {savedBlocks.length === 0 && (
            <p className="text-solar-base01 text-sm p-2">No saved blocks yet.</p>
          )}
          {savedBlocks.map(b => (
            <div key={b.title} className="flex justify-between items-center p-2 rounded hover:bg-solar-base1/20 group transition-colors">
              <button onClick={() => handleLoad(b)} className="text-left flex-1 truncate text-solar-base02 font-medium">
                {b.title}
              </button>
              <button onClick={() => handleDelete(b.title)} className="text-solar-red opacity-0 group-hover:opacity-100 px-2 font-bold text-lg">
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-solar-base2 border-b border-solar-base1/30 flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-solar-base01 hover:text-solar-blue transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-xl font-bold text-solar-base03 tracking-wide">D&D Beyond Compiler</h1>
          </div>
          <div className="flex items-center space-x-4">
            <input 
              type="text" 
              placeholder="Block Title..." 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-solar-base3 border border-solar-base1/50 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-solar-blue focus:ring-1 focus:ring-solar-blue text-solar-base02 placeholder-solar-base0"
            />
            <button 
              onClick={handleSave}
              className="bg-solar-blue hover:bg-solar-cyan text-solar-base3 px-4 py-1.5 rounded text-sm font-semibold transition-colors shadow-sm"
            >
              Save Block
            </button>
          </div>
        </header>

        {/* Editor Split Pane */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Pane: Shorthand Input */}
          <div className="flex-1 flex flex-col border-r border-solar-base1/30 bg-solar-base3">
            <div className="h-10 bg-solar-base2 flex items-center px-4 justify-between border-b border-solar-base1/30">
              <span className="text-xs font-bold text-solar-base01 uppercase tracking-wider">Shorthand Input (Emacs)</span>
              <span className="text-xs text-solar-base01">[[hit: +X]], [[dmg: 1d8, type]], [[spell: name]]</span>
            </div>
            <div className="flex-1 overflow-auto bg-solar-base3">
              <CodeMirror
                value={input}
                theme={solarizedLight}
                extensions={[markdown({ base: markdownLanguage }), emacs(), EditorView.lineWrapping]}
                onChange={onChange}
                className="h-full text-base [&_.cm-scroller]:font-mono"
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLineGutter: true,
                  highlightActiveLine: false,
                  foldGutter: true,
                }}
              />
            </div>
          </div>

          {/* Right Pane: JSON Output */}
          <div className="flex-1 flex flex-col bg-solar-base3 relative min-w-0">
            <div className="h-10 bg-solar-base2 flex items-center px-4 justify-between border-b border-solar-base1/30">
              <span className="text-xs font-bold text-solar-base01 uppercase tracking-wider">Output (D&D Beyond Code)</span>
              <button 
                onClick={handleCopy}
                className="text-xs bg-solar-blue/10 text-solar-blue hover:bg-solar-blue/20 px-3 py-1 rounded transition-colors font-semibold border border-solar-blue/20"
              >
                Copy to Clipboard
              </button>
            </div>
            <div className="flex-1 p-5 overflow-auto break-words">
              <pre className="font-mono text-[15px] text-solar-base02 whitespace-pre-wrap break-words leading-relaxed font-medium">
                {output || <span className="text-solar-base0 italic font-normal">Output will appear here...</span>}
              </pre>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
