import React, { useState, useEffect, useRef } from 'react';
import Editor from "@monaco-editor/react";
import { useTheme } from '../context/ThemeContext';

const PythonRunner = ({ initialCode, storageKey }) => {
    const { theme } = useTheme();
    const [pyodide, setPyodide] = useState(null);
    const [isPyodideLoading, setIsPyodideLoading] = useState(true);
    const [executingCellId, setExecutingCellId] = useState(null);
    const [focusedCellId, setFocusedCellId] = useState(null);

    // State to hold multiple notebook cells
    const [cells, setCells] = useState(() => {
        if (storageKey) {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    console.error("Failed to parse saved code", e);
                }
            }
        }
        return [{
            id: 'cell-1',
            code: initialCode || `# Initial Setup
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

print("Libraries loaded successfully!")

# Example Plot
x = np.linspace(0, 10, 100)
y = np.sin(x)
plt.figure()
plt.plot(x, y)
plt.title("Sine Wave")
plt.show()`,
            output: [],
            plots: []
        }];
    });

    // Autosave when cells change
    useEffect(() => {
        if (storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(cells));
        }
    }, [cells, storageKey]);

    // This ref helps prevent double initialization
    const pyodideLoadingRef = useRef(false);

    // Initialize Pyodide
    useEffect(() => {
        const loadPyodideEngine = async () => {
            if (pyodideLoadingRef.current) return;
            pyodideLoadingRef.current = true;

            try {
                if (!window.loadPyodide) {
                    let attempts = 0;
                    while (!window.loadPyodide && attempts < 20) {
                        await new Promise(r => setTimeout(r, 100));
                        attempts++;
                    }
                    if (!window.loadPyodide) throw new Error("Pyodide script not loaded");
                }

                const pyInstance = await window.loadPyodide({
                    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
                });

                await pyInstance.loadPackage("micropip");
                const micropip = pyInstance.pyimport("micropip");
                await micropip.install(["numpy", "pandas", "matplotlib"]);

                setPyodide(pyInstance);
            } catch (err) {
                console.error("Failed to load Pyodide:", err);
                setCells(prevCells => prevCells.map(c =>
                    c.id === 'cell-1'
                        ? { ...c, output: [`Error: Failed to load Python environment. ${err.message}`] }
                        : c
                ));
            } finally {
                setIsPyodideLoading(false);
            }
        };
        loadPyodideEngine();
    }, []);

    // Memoize options to prevent editor re-flash on typing
    const editorOptions = React.useMemo(() => ({
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 8, bottom: 8 },
        renderLineHighlight: "none",
        fontFamily: "'MesloLGS NF', 'Fira Code', Consolas, monospace",
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        folding: false,
        glyphMargin: false,
        scrollbar: {
            vertical: 'hidden',
            horizontal: 'hidden',
            handleMouseWheel: false
        }
    }), []);

    // Cell Operations
    const addCell = (index) => {
        const newCell = { id: `cell-${Date.now()}`, code: '', output: [], plots: [] };
        const newCells = [...cells];
        newCells.splice(index + 1, 0, newCell);
        setCells(newCells);
        setFocusedCellId(newCell.id);
    };

    const moveCellUp = (index) => {
        if (index === 0) return; // Can't move first cell up
        const newCells = [...cells];
        [newCells[index - 1], newCells[index]] = [newCells[index], newCells[index - 1]];
        setCells(newCells);
    };

    const moveCellDown = (index) => {
        if (index === cells.length - 1) return; // Can't move last cell down
        const newCells = [...cells];
        [newCells[index], newCells[index + 1]] = [newCells[index + 1], newCells[index]];
        setCells(newCells);
    };

    const deleteCell = (index) => {
        if (cells.length === 1) return; // Don't delete if only one cell remains
        const newCells = cells.filter((_, i) => i !== index);
        setCells(newCells);
        setFocusedCellId(null);
    };

    const updateCellCode = (id, newCode) => {
        setCells(prevCells => prevCells.map(cell => cell.id === id ? { ...cell, code: newCode } : cell));
    };

    const runCell = async (cellId) => {
        if (!pyodide) return;
        setExecutingCellId(cellId);
        setFocusedCellId(cellId);

        const cellIndex = cells.findIndex(c => c.id === cellId);
        const cell = cells[cellIndex];

        // Clear previous outputs
        setCells(prevCells => prevCells.map(c =>
            c.id === cellId ? { ...c, output: [], plots: [] } : c
        ));

        try {
            let currentPlots = [];
            window.create_plot = (imgStr) => {
                currentPlots.push(imgStr);
            };

            let currentOutput = [];
            pyodide.setStdout({
                batched: (msg) => {
                    currentOutput.push(msg);
                }
            });

            await pyodide.runPythonAsync(`
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import io
import base64
from js import create_plot

def show_plot():
    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode('utf-8')
    create_plot(img_str)
    plt.clf()

plt.show = show_plot
            `);

            await pyodide.runPythonAsync(cell.code);

            setCells(prevCells => prevCells.map(c =>
                c.id === cellId
                    ? { ...c, output: currentOutput, plots: currentPlots }
                    : c
            ));

        } catch (err) {
            console.error(err);
            setCells(prevCells => prevCells.map(c =>
                c.id === cellId
                    ? { ...c, output: [`Error: ${err}`], plots: [] }
                    : c
            ));
        } finally {
            setExecutingCellId(null);
        }
    };

    const runAllCells = async () => {
        if (!pyodide || isPyodideLoading) return;
        for (const cell of cells) {
            await runCell(cell.id);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-gray-300 relative font-sans transition-colors duration-200">
            {/* Sticky Toolbar */}
            <div className="sticky top-0 z-30 flex items-center justify-between px-2 py-1 bg-gray-100 dark:bg-[#2d2d2d] border-b border-gray-200 dark:border-black shadow-md h-9">
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => addCell(-1)}
                        className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#3d3d3d] rounded transition-colors"
                        title="Insert Code Cell"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Code
                    </button>
                    <div className="h-4 w-[1px] bg-gray-300 dark:bg-gray-600 mx-1" />
                    <button
                        onClick={runAllCells}
                        className="text-xs text-gray-700 dark:text-gray-400 hover:text-black dark:hover:text-white px-2 py-1 transition-colors"
                    >
                        Run all
                    </button>
                </div>
                <div className="flex items-center space-x-3 pr-2">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">RAM: {isPyodideLoading ? '---' : '0.28 GB'} / 12.68 GB</span>
                    <div className={`w-2 h-2 rounded-full ${isPyodideLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} title={isPyodideLoading ? "Connecting..." : "Connected"} />
                </div>
            </div>

            {/* Notebook Area */}
            <div
                className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 bg-white dark:bg-[#1e1e1e]"
                onClick={() => setFocusedCellId(null)}
            >
                {cells.map((cell, index) => (
                    <div
                        key={cell.id}
                        className="group relative transition-all duration-200"
                        onClick={(e) => { e.stopPropagation(); setFocusedCellId(cell.id); }}
                    >
                        {/* Focus Indicator (Blue Bar on Left) */}
                        <div className={`absolute left-[-16px] top-0 bottom-0 w-1 bg-blue-500 transition-opacity duration-200 ${focusedCellId === cell.id ? 'opacity-100' : 'opacity-0'}`} />

                        {/* Hover Add Buttons (Between Cells) */}
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex space-x-0.5 shadow-sm">
                            <button
                                onClick={(e) => { e.stopPropagation(); addCell(index - 1); }}
                                className="flex items-center gap-1 text-[10px] bg-gray-100 dark:bg-[#2d2d2d] border border-gray-300 dark:border-gray-600 px-3 py-0.5 rounded text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                            >
                                + Code
                            </button>
                        </div>

                        {/* Delete Button (Top Right Corner) */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <button
                                onClick={(e) => { e.stopPropagation(); deleteCell(index); }}
                                disabled={cells.length === 1}
                                className={`p-1.5 rounded transition-all ${cells.length === 1
                                        ? 'opacity-30 cursor-not-allowed text-gray-400'
                                        : 'hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400'
                                    }`}
                                title="Delete cell"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>

                        <div className={`flex items-start rounded pt-1 pb-2 pl-0 pr-1 transition-colors ${focusedCellId === cell.id ? 'bg-gray-50 dark:bg-[#252525] shadow-sm' : ''}`}>
                            {/* Gutter / Run Button */}
                            <div className="w-10 flex-shrink-0 flex flex-col items-center pt-1 group/gutter relative select-none">
                                <button
                                    onClick={(e) => { e.stopPropagation(); runCell(cell.id); }}
                                    disabled={isPyodideLoading || (executingCellId && executingCellId !== cell.id)}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-sm mt-1 ring-2 ring-transparent ${(executingCellId === cell.id)
                                        ? 'ring-blue-500 bg-transparent'
                                        : 'bg-gray-200 dark:bg-[#444] hover:bg-gray-300 dark:hover:bg-[#666] text-gray-700 dark:text-white'
                                        }`}
                                >
                                    {(executingCellId === cell.id) ? (
                                        <svg className="animate-spin h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : (
                                        <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                    )}
                                </button>

                                {/* Move Up/Down/Delete Buttons */}
                                <div className="flex flex-col gap-0.5 mt-2 opacity-0 group-hover/gutter:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); moveCellUp(index); }}
                                        disabled={index === 0}
                                        className={`w-5 h-5 rounded flex items-center justify-center transition-all ${index === 0
                                            ? 'opacity-30 cursor-not-allowed'
                                            : 'hover:bg-gray-200 dark:hover:bg-[#555] text-gray-600 dark:text-gray-400'
                                            }`}
                                        title="Move cell up"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); moveCellDown(index); }}
                                        disabled={index === cells.length - 1}
                                        className={`w-5 h-5 rounded flex items-center justify-center transition-all ${index === cells.length - 1
                                            ? 'opacity-30 cursor-not-allowed'
                                            : 'hover:bg-gray-200 dark:hover:bg-[#555] text-gray-600 dark:text-gray-400'
                                            }`}
                                        title="Move cell down"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteCell(index); }}
                                        disabled={cells.length === 1}
                                        className={`w-5 h-5 rounded flex items-center justify-center transition-all ${cells.length === 1
                                            ? 'opacity-30 cursor-not-allowed'
                                            : 'hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400'
                                            }`}
                                        title="Delete cell"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>

                            {/* Editor & Output Container */}
                            <div className="flex-1 flex flex-col min-w-0">
                                {/* Editor Box */}
                                <div className={`relative rounded-t-md border w-full overflow-hidden transition-colors ${focusedCellId === cell.id
                                    ? 'border-gray-400 dark:border-gray-600 bg-white dark:bg-[#282828]'
                                    : 'border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#282828]'
                                    }`}>
                                    {(() => {
                                        const lineCount = Math.max(1, cell.code.split('\n').length);
                                        const lineHeight = 19; // approximate px per line
                                        const padding = 16; // editor padding
                                        const calculatedHeight = Math.max(35, Math.min(800, lineCount * lineHeight + padding));
                                        return (
                                            <Editor
                                                height={`${calculatedHeight}px`}
                                                width="100%"
                                                defaultLanguage="python"
                                                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                                                value={cell.code}
                                                onChange={(val) => updateCellCode(cell.id, val)}
                                                options={editorOptions}
                                                loading={null}
                                            />
                                        );
                                    })()}
                                </div>

                                {/* Output Area */}
                                {(cell.output.length > 0 || cell.plots.length > 0) && (
                                    <div className="mt-2 ml-0 pl-4 py-2 border-l-2 border-gray-300 dark:border-gray-700/50 bg-gray-50 dark:bg-[#1e1e1e]">
                                        {cell.output.length > 0 && (
                                            <div className="font-mono text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-3 font-light pb-2">
                                                {cell.output.map((line, i) => <div key={i}>{line}</div>)}
                                            </div>
                                        )}
                                        {cell.plots.map((imgStr, i) => (
                                            <div key={i} className="mb-2">
                                                <img src={`data:image/png;base64,${imgStr}`} alt="Output Plot" className="max-w-full rounded bg-white p-1" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Add Cell Button at Bottom */}
                <div className="flex justify-center pt-4 pb-8">
                    <button
                        onClick={() => addCell(cells.length - 1)}
                        className="flex items-center gap-1 text-[10px] bg-gray-100 dark:bg-[#2d2d2d] border border-gray-300 dark:border-gray-600 px-3 py-0.5 rounded text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-all shadow-sm"
                        title="Add new code cell"
                    >
                        + Code
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PythonRunner;
