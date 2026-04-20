import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Editor from "@monaco-editor/react";
import Stomp from 'stompjs';
import SockJS from 'sockjs-client';
import axios from 'axios';
import toast from 'react-hot-toast';
import Split from 'react-split';
import { initVimMode } from 'monaco-vim';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import ReactMarkdown from 'react-markdown'; 
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { Awareness } from 'y-protocols/awareness';
import Client from './Client';
import FileExplorer, { getFileIcon } from './FileExplorer';
import './CodeEditor.css'; 

const API_BASE_URL = 'https://vylop.onrender.com';
const loadedRooms = new Set();

const CODE_SNIPPETS = {
    java: `// Welcome to Vylop!\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
    python: `# Welcome to Vylop!\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()`,
    cpp: `// Welcome to Vylop!\n\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
    javascript: `// Welcome to Vylop!\n\nconsole.log("Hello, World!");`,
    typescript: `// Welcome to Vylop!\n\nconst greeting: string = "Hello, World!";\nconsole.log(greeting);`,
    go: `// Welcome to Vylop!\n\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}`,
    rust: `// Welcome to Vylop!\n\nfn main() {\n    println!("Hello, World!");\n}`,
    markdown: `# Welcome to Vylop!\n\nStart writing your markdown here...\n\n- Real-time collaboration\n- Live preview\n- Awesome features` 
};

// ─── MOCK PROBLEM DATABASE ────────────────────────────────────────────────
const MOCK_PROBLEMS = {
    "two-sum": {
        id: "two-sum",
        title: "1. Two Sum",
        difficulty: "Easy",
        description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have **exactly one solution**, and you may not use the same element twice.\n\nYou can return the answer in any order.",
        examples: [
            { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]." },
            { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
            { input: "nums = [3,3], target = 6", output: "[0,1]" }
        ],
        constraints: [
            "2 <= nums.length <= 10^4",
            "-10^9 <= nums[i] <= 10^9",
            "-10^9 <= target <= 10^9",
            "Only one valid answer exists."
        ]
    }
};

const getExtension = (lang) => {
    const map = { java: 'java', python: 'py', cpp: 'cpp', javascript: 'js', typescript: 'ts', go: 'go', rust: 'rs', markdown: 'md' };
    return map[lang] || 'txt';
};

const getLanguageFromExtension = (fileName) => {
    const ext = fileName.split('.').pop();
    const map = { java: 'java', py: 'python', cpp: 'cpp', js: 'javascript', ts: 'typescript', go: 'go', rs: 'rust', md: 'markdown' };
    return map[ext] || 'plaintext';
};

const CURSOR_COLORS = ['#FF007F', '#00E5FF', '#FFD700', '#00FF00', '#9D00FF', '#FF7F50', '#00BFFF', '#FF1493'];

const resolveFileName = (rawFile, files) => {
    if (!rawFile) return rawFile;
    if (files[rawFile]) return rawFile;
    const cleaned = rawFile.replace(/^\.\//, '').replace(/^\//, '');
    if (files[cleaned]) return cleaned;
    const match = Object.keys(files).find(f =>
        f.endsWith('/' + cleaned) || f.endsWith('\\' + cleaned) || f === cleaned
    );
    return match || rawFile;
};

// ─── SAFE CRDT Helpers ────────────────────────────────────────────────────
const toBase64 = (arr) => {
    const bytes = new Uint8Array(arr);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

const fromBase64 = (str) => {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

// ─── Error Parsers ────────────────────────────────────────────────────────

const parseJavaErrors = (output, files) => {
    const errors = [];
    const regex = /([a-zA-Z0-9_/\\.-]+\.java):(\d+):\s*(error|warning):\s*(.+)/g;
    let match;
    while ((match = regex.exec(output)) !== null) {
        errors.push({
            fileName: resolveFileName(match[1], files),
            line: parseInt(match[2], 10),
            col: 1,
            message: match[4].trim(),
            severity: match[3] === 'error' ? 'error' : 'warning',
        });
    }
    return errors;
};

const parsePythonErrors = (output, files) => {
    const errors = [];
    const regex = /File "([^"]+)",\s*line\s*(\d+)/g;
    const msgRegex = /^(\w+Error|\w+Exception):\s*(.+)/m;
    let match;
    while ((match = regex.exec(output)) !== null) {
        const msgMatch = output.slice(match.index).match(msgRegex);
        errors.push({
            fileName: resolveFileName(match[1], files),
            line: parseInt(match[2], 10),
            col: 1,
            message: msgMatch ? `${msgMatch[1]}: ${msgMatch[2]}` : 'Error',
            severity: 'error',
        });
    }
    return errors;
};

const parseCppErrors = (output, files) => {
    const errors = [];
    const regex = /([a-zA-Z0-9_/\\.-]+\.(?:cpp|cc|h|hpp)):(\d+):(\d+):\s*(error|warning|note):\s*(.+)/g;
    let match;
    while ((match = regex.exec(output)) !== null) {
        errors.push({
            fileName: resolveFileName(match[1], files),
            line: parseInt(match[2], 10),
            col: parseInt(match[3], 10),
            message: match[5].trim(),
            severity: match[4] === 'error' ? 'error' : match[4] === 'warning' ? 'warning' : 'info',
        });
    }
    return errors;
};

const parseGoErrors = (output, files) => {
    const errors = [];
    const regex = /\.?\/?([\w/.-]+\.go):(\d+):(\d+):\s*(.+)/g;
    let match;
    while ((match = regex.exec(output)) !== null) {
        errors.push({
            fileName: resolveFileName(match[1], files),
            line: parseInt(match[2], 10),
            col: parseInt(match[3], 10),
            message: match[4].trim(),
            severity: 'error',
        });
    }
    return errors;
};

const parseRustErrors = (output, files) => {
    const errors = [];
    const regex = /-+>\s*([\w/.-]+\.rs):(\d+):(\d+)/g;
    const msgRegex = /^(error|warning)(\[[\w]+\])?:\s*(.+)/m;
    let match;
    while ((match = regex.exec(output)) !== null) {
        const before = output.slice(Math.max(0, match.index - 200), match.index);
        const msgMatch = before.match(msgRegex);
        errors.push({
            fileName: resolveFileName(match[1], files),
            line: parseInt(match[2], 10),
            col: parseInt(match[3], 10),
            message: msgMatch ? msgMatch[3].trim() : 'Error',
            severity: msgMatch?.[1] === 'warning' ? 'warning' : 'error',
        });
    }
    return errors;
};

const parseErrors = (output, language, files) => {
    if (!output || output === 'Running...') return [];
    const hasError = /(error|exception|traceback|failed|undefined|cannot|no such|warning)/i.test(output);
    if (!hasError) return [];
    switch (language) {
        case 'java': return parseJavaErrors(output, files);
        case 'python': return parsePythonErrors(output, files);
        case 'cpp': return parseCppErrors(output, files);
        case 'go': return parseGoErrors(output, files);
        case 'rust': return parseRustErrors(output, files);
        default: return [];
    }
};

const getSeverityColor = (severity) => {
    if (severity === 'error') return '#ff6b6b';
    if (severity === 'warning') return '#f0883e';
    return '#58a6ff';
};

const CodeEditor = () => {
    const { roomId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [username] = useState(() => location.state?.username || localStorage.getItem('username') || '');
    const [roomName, setRoomName] = useState(() => location.state?.roomName || "Syncing Workspace...");

    const [files, setFiles] = useState({});
    const [openFiles, setOpenFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    
    // NEW INTERVIEW STATE
    const [currentProblem, setCurrentProblem] = useState(null);
    
    const [output, setOutput] = useState("");
    const [userInput, setUserInput] = useState(""); 
    const [isRunning, setIsRunning] = useState(false);
    const [isSaving, setIsSaving] = useState(false); 

    const [users, setUsers] = useState([]); 
    const [currentUserRole, setCurrentUserRole] = useState('READ_ONLY');

    const [editorErrors, setEditorErrors] = useState({});
    const decorationIds = useRef([]);
    const viewZoneIds = useRef([]);

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isExplorerExpanded, setIsExplorerExpanded] = useState(true);
    const [isOnlineExpanded, setIsOnlineExpanded] = useState(true);
    const [isChatExpanded, setIsChatExpanded] = useState(true);

    const [isVimMode, setIsVimMode] = useState(false);
    const [showMarkdownPreview, setShowMarkdownPreview] = useState(false); 
    const [messages, setMessages] = useState([]);
    const [chatMsg, setChatMsg] = useState("");
    const [typingUsers, setTypingUsers] = useState([]);
    const [splitDirection, setSplitDirection] = useState(window.innerWidth < 900 ? 'vertical' : 'horizontal');
    const [wsConnected, setWsConnected] = useState(false);

    const [editorTheme, setEditorTheme] = useState(() => localStorage.getItem('editorTheme') || 'vs-dark');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newFileLang, setNewFileLang] = useState("python");
    const [newFileName, setNewFileName] = useState("");

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState(null);

    const [isSecretsModalOpen, setIsSecretsModalOpen] = useState(false);
    const [secrets, setSecrets] = useState([{ key: '', value: '' }]);

    // NEW LEAVE MODAL STATE
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const vimInstanceRef = useRef(null); 
    const remoteCursors = useRef({}); 
    const chatContainerRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const stompClient = useRef(null);
    const isConnected = useRef(false);
    const notifiedUsers = useRef(new Set()); 
    const pendingCursors = useRef({});
    const userColorMap = useRef({});
    const nextColorIndex = useRef(0);
    const disconnectTimeoutRef = useRef(null); 
    const fileInputRef = useRef(null); 

    // ─── CRDT State & Load Flow ───────────────────────────────────────────────
    const ydocRef = useRef(new Y.Doc());
    const awarenessRef = useRef(new Awareness(ydocRef.current));
    const ymonacoBindingRef = useRef(null);
    const isHostRef = useRef(false);
    
    const [isWorkspaceLoaded, setIsWorkspaceLoaded] = useState(false);
    const loadedFilesRef = useRef({});
    const ydocInitialized = useRef(false);

    const isHost = currentUserRole === 'HOST';
    const canEdit = currentUserRole === 'HOST' || currentUserRole === 'EDITOR';

    useEffect(() => {
        isHostRef.current = currentUserRole === 'HOST';
    }, [currentUserRole]);

    const getTooltip = (requiredRole) => {
        if (requiredRole === 'HOST' && !isHost) return "Only the host can perform this action";
        if (requiredRole === 'EDITOR' && !canEdit) return "You are in read-only mode";
        return "";
    };

    const getUserColor = (user) => {
        if (!userColorMap.current[user]) {
            userColorMap.current[user] = CURSOR_COLORS[nextColorIndex.current % CURSOR_COLORS.length];
            nextColorIndex.current += 1;
        }
        return userColorMap.current[user];
    };

    // ─── 1. FETCH DB DATA ────────────────────────────────────────────────────
    useEffect(() => {
        let isMounted = true;
        const fetchWorkspaceData = async () => {
            if (loadedRooms.has(roomId)) return;
            loadedRooms.add(roomId);
            try {
                const metaRes = await axios.get(`${API_BASE_URL}/api/workspace/${roomId}`);
                if (isMounted && metaRes.data?.name) setRoomName(metaRes.data.name);
                
                const response = await axios.get(`${API_BASE_URL}/api/workspace/${roomId}/load`);
                if (!isMounted) return;
                
                loadedFilesRef.current = response.data || {};
                
                if (Object.keys(loadedFilesRef.current).length > 0) {
                    const newFilesState = {};
                    Object.keys(loadedFilesRef.current).forEach(fileName => {
                        newFilesState[fileName] = { name: fileName, language: getLanguageFromExtension(fileName) };
                    });
                    setFiles(newFilesState);
                    const firstFile = Object.keys(newFilesState)[0];
                    setActiveFile(firstFile);
                    setOpenFiles([firstFile]);
                }
            } catch (error) {
                if (isMounted) {
                    loadedRooms.delete(roomId);
                    setRoomName(prev => prev === "Syncing Workspace..." ? "Dev Workspace" : prev);
                }
            } finally {
                if (isMounted) setIsWorkspaceLoaded(true);
            }
        };
        if (roomId && username) fetchWorkspaceData();
        return () => { isMounted = false; loadedRooms.delete(roomId); };
    }, [roomId, username]);

    // ─── 2. BROADCAST YJS UPDATES ────────────────────────────────────────────
    useEffect(() => {
        const ydoc = ydocRef.current;
        const updateHandler = (update, origin) => {
            if (origin !== 'remote' && stompClient.current?.connected) {
                const updateArray = Array.from(update);
                stompClient.current.send(`/app/yjs/${roomId}`, {}, JSON.stringify({
                    sender: username,
                    type: 'SYNC',
                    update: updateArray
                }));
            }
        };
        ydoc.on('update', updateHandler);
        return () => ydoc.off('update', updateHandler);
    }, [roomId, username]);

    // ─── Apply decorations + inline view zones ────────────────────────────────
    const applyDecorations = useCallback((fileName) => {
        if (!editorRef.current || !monacoRef.current) return;
        const monaco = monacoRef.current;
        const editor = editorRef.current;
        const errors = editorErrors[fileName] || [];

        const newDecorations = errors.map(err => ({
            range: new monaco.Range(err.line, err.col || 1, err.line, Number.MAX_VALUE),
            options: {
                inlineClassName: err.severity === 'error' ? 'diagnostic-error' : err.severity === 'warning' ? 'diagnostic-warning' : 'diagnostic-info',
                hoverMessage: { value: `**${err.severity.toUpperCase()}**: ${err.message}` },
                overviewRuler: { color: getSeverityColor(err.severity), position: monaco.editor.OverviewRulerLane.Right },
                minimap: { color: getSeverityColor(err.severity), position: monaco.editor.MinimapPosition.Inline },
                glyphMarginClassName: err.severity === 'error' ? 'diagnostic-glyph-error' : 'diagnostic-glyph-warning',
            }
        }));
        decorationIds.current = editor.deltaDecorations(decorationIds.current, newDecorations);

        editor.changeViewZones(accessor => {
            viewZoneIds.current.forEach(id => accessor.removeZone(id));
            viewZoneIds.current = [];

            errors.forEach(err => {
                const color = getSeverityColor(err.severity);
                const icon = err.severity === 'error' ? '●' : '▲';
                const marginDomNode = document.createElement('div');
                const domNode = document.createElement('div');
                domNode.style.cssText = `
                    display: flex; align-items: center; gap: 6px; padding: 1px 12px 1px 12px;
                    font-family: JetBrains Mono, monospace; font-size: 12px; color: ${color};
                    background: ${color}11; border-left: 2px solid ${color}66; white-space: nowrap;
                    overflow: hidden; text-overflow: ellipsis; cursor: pointer; box-sizing: border-box; width: 100%; height: 100%;
                `;
                domNode.title = `Line ${err.line}: ${err.message}`;
                domNode.innerHTML = `<span style="opacity:0.7;font-size:10px;margin-right:4px">${icon}</span>${err.message}`;
                domNode.onclick = () => {
                    editor.revealLineNearTop(err.line);
                    editor.setPosition({ lineNumber: err.line, column: 1 });
                    editor.focus();
                };

                const zoneId = accessor.addZone({
                    afterLineNumber: err.line,
                    afterColumn: Number.MAX_VALUE,
                    heightInLines: 1,
                    minWidthInPx: 200,
                    domNode,
                    marginDomNode,
                });
                viewZoneIds.current.push(zoneId);
            });
        });
    }, [editorErrors]);

    useEffect(() => {
        applyDecorations(activeFile);
        return () => {
            if (editorRef.current) {
                editorRef.current.changeViewZones(accessor => {
                    viewZoneIds.current.forEach(id => accessor.removeZone(id));
                    viewZoneIds.current = [];
                });
            }
        };
    }, [activeFile, editorErrors, applyDecorations]);

    useEffect(() => {
        const handleResize = () => setSplitDirection(window.innerWidth < 900 ? 'vertical' : 'horizontal');
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        return () => { if (vimInstanceRef.current) vimInstanceRef.current.dispose(); };
    }, []);

    const updateRemoteCursor = (user, pos, file) => {
        if (user === username) return;
        if (file !== activeFile) {
            if (remoteCursors.current[user] && editorRef.current) editorRef.current.removeContentWidget(remoteCursors.current[user]);
            return;
        }
        if (!editorRef.current || !monacoRef.current) { pendingCursors.current[user] = { pos, file }; return; }
        if (remoteCursors.current[user]) editorRef.current.removeContentWidget(remoteCursors.current[user]);
        const userColor = getUserColor(user);
        const lineHeight = editorRef.current.getOption(monacoRef.current.editor.EditorOption.lineHeight);
        const widget = {
            getId: () => `cursor-${user}`,
            getDomNode: () => {
                const node = document.createElement('div');
                node.className = 'remote-cursor';
                node.style.height = `${lineHeight}px`;
                node.style.backgroundColor = userColor;
                const label = document.createElement('div');
                label.className = 'remote-cursor-label';
                label.innerText = user;
                label.style.backgroundColor = userColor;
                label.style.top = pos.lineNumber === 1 ? `${lineHeight}px` : '-20px';
                label.style.borderRadius = pos.lineNumber === 1 ? '0 3px 3px 3px' : '3px 3px 3px 0';
                node.appendChild(label);
                return node;
            },
            getPosition: () => ({ position: { lineNumber: pos.lineNumber, column: pos.column }, preference: [monacoRef.current.editor.ContentWidgetPositionPreference.EXACT] })
        };
        editorRef.current.addContentWidget(widget);
        remoteCursors.current[user] = widget;
    };

    const bindMonacoToYjs = useCallback((fileName, editor = editorRef.current) => {
        if (!editor) return;
        
        if (ymonacoBindingRef.current) {
            ymonacoBindingRef.current.destroy();
            ymonacoBindingRef.current = null;
        }

        const ytext = ydocRef.current.getText(fileName);
        
        const currentYjsText = ytext.toString();
        if (currentYjsText.length > 0 && editor.getValue() === '') {
            editor.setValue(currentYjsText);
        }
        
        ymonacoBindingRef.current = new MonacoBinding(
            ytext, 
            editor.getModel(), 
            new Set([editor]), 
            awarenessRef.current
        );
    }, []);

    useEffect(() => {
        if (activeFile && editorRef.current) {
            bindMonacoToYjs(activeFile);
        }
    }, [activeFile, bindMonacoToYjs]);

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        window.monaco = monaco;

        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({ target: monaco.languages.typescript.ScriptTarget.ES2020, allowNonTsExtensions: true, checkJs: true });
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({ target: monaco.languages.typescript.ScriptTarget.ES2020, allowNonTsExtensions: true, strict: true });

        if (!document.getElementById('diagnostic-styles')) {
            const style = document.createElement('style');
            style.id = 'diagnostic-styles';
            style.textContent = `
                .diagnostic-error { text-decoration: underline wavy #ff6b6b; text-underline-offset: 3px; }
                .diagnostic-warning { text-decoration: underline wavy #f0883e; text-underline-offset: 3px; }
                .diagnostic-info { text-decoration: underline wavy #58a6ff; text-underline-offset: 3px; }
                .diagnostic-glyph-error::before { content: '●'; color: #ff6b6b; font-size: 10px; }
                .diagnostic-glyph-warning::before { content: '▲'; color: #f0883e; font-size: 10px; }
            `;
            document.head.appendChild(style);
        }

        if (activeFile) {
            bindMonacoToYjs(activeFile, editor);
        }

        Object.keys(pendingCursors.current).forEach(user => {
            if (pendingCursors.current[user].file === activeFile) updateRemoteCursor(user, pendingCursors.current[user].pos, pendingCursors.current[user].file);
        });
        pendingCursors.current = {};

        editor.onDidChangeCursorPosition((e) => {
            if (stompClient.current?.connected && activeFile) {
                stompClient.current.send(`/app/cursor/${roomId}`, {}, JSON.stringify({ username, lineNumber: e.position.lineNumber, column: e.position.column, fileName: activeFile }));
            }
        });

        applyDecorations(activeFile);
    };

    const toggleVimMode = () => {
        if (!editorRef.current) return;
        if (isVimMode) {
            if (vimInstanceRef.current) { vimInstanceRef.current.dispose(); vimInstanceRef.current = null; }
            const statusNode = document.getElementById('vim-status-bar');
            if (statusNode) statusNode.innerHTML = '';
            setIsVimMode(false);
            toast("Vim Mode Disabled", { icon: '⌨️' });
        } else {
            vimInstanceRef.current = initVimMode(editorRef.current, document.getElementById('vim-status-bar'));
            setIsVimMode(true);
            toast.success("Vim Mode Enabled");
        }
    };

    const handleThemeChange = (e) => {
        setEditorTheme(e.target.value);
        localStorage.setItem('editorTheme', e.target.value);
        toast(`Theme set to ${e.target.value}`, { icon: '🎨' });
    };

    const changeUserRole = (targetUser, newRole) => {
        if (stompClient.current?.connected && isHost) {
            stompClient.current.send(`/app/room/${roomId}/roleChange`, {}, JSON.stringify({ targetUser, newRole }));
        }
    };

    const kickTargetUser = (targetUser) => {
        if (stompClient.current?.connected && isHost) {
            stompClient.current.send(`/app/room/${roomId}/kick`, {}, JSON.stringify({ targetUser }));
        }
    };

    // ─── 3. WEBSOCKET CONNECTION & RECEIVING ─────────────────────────────────
    useEffect(() => {
        if (!username || !isWorkspaceLoaded) return; 
        if (disconnectTimeoutRef.current) { clearTimeout(disconnectTimeoutRef.current); disconnectTimeoutRef.current = null; }
        let reconnectTimeout;
        
        const handleBeforeUnload = () => {
            if (stompClient.current?.connected) {
                stompClient.current.send(`/app/room/${roomId}/leave`, {}, JSON.stringify({ username, type: "LEAVE" }));
                stompClient.current.disconnect();
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        const connectToSocket = () => {
            if (isConnected.current) return;
            const socket = new SockJS(`${API_BASE_URL}/ws`);
            const client = Stomp.over(socket);
            client.debug = () => {};
            client.connect({}, () => {
                stompClient.current = client;
                isConnected.current = true;
                setWsConnected(true);
                clearTimeout(reconnectTimeout);

                client.subscribe(`/topic/yjs/${roomId}`, (msg) => {
                    try {
                        let payload = msg.body;
                        if (typeof payload === 'string') {
                            payload = JSON.parse(payload);
                        }
                        if (typeof payload === 'string') {
                            payload = JSON.parse(payload);
                        }

                        if (payload.type === 'SYNC' && payload.sender !== username) {
                            const updateArray = new Uint8Array(payload.update);
                            Y.applyUpdate(ydocRef.current, updateArray, 'remote');
                        } else if (payload.type === 'REQUEST_SYNC' && isHostRef.current && payload.sender !== username) {
                            const state = Y.encodeStateAsUpdate(ydocRef.current);
                            stompClient.current.send(`/app/yjs/${roomId}`, {}, JSON.stringify({
                                sender: username,
                                type: 'SYNC',
                                update: Array.from(state)
                            }));
                        }
                    } catch (err) {
                        console.error("[VYLOP DEBUG] Yjs Sync Parsing Error:", err);
                    }
                });

                client.subscribe(`/topic/code/${roomId}`, (msg) => {
                    const body = JSON.parse(msg.body);
                    if (body.type === "DELETE") {
                        setFiles(prev => { const n = { ...prev }; delete n[body.fileName]; return n; });
                        setOpenFiles(prev => {
                            const n = prev.filter(f => f !== body.fileName);
                            if (activeFile === body.fileName) setActiveFile(n.length > 0 ? n[n.length - 1] : null);
                            return n;
                        });
                        setEditorErrors(prev => { const n = { ...prev }; delete n[body.fileName]; return n; });
                        if (body.sender !== username) toast(`${body.sender} deleted ${body.fileName}`, { icon: '🗑️' });
                    } else if (body.type === "METADATA") {
                        setFiles(prev => ({ ...prev, [body.fileName]: { name: body.fileName, language: body.language } }));
                    }
                });

                client.subscribe(`/topic/users/${roomId}`, (msg) => {
                    const body = JSON.parse(msg.body);
                    
                    if (!ydocInitialized.current) {
                        const me = body.users.find(u => u.username === username);
                        if (me) {
                            if (body.users.length === 1) {
                                ydocRef.current.transact(() => {
                                    const dbFiles = Object.keys(loadedFilesRef.current);
                                    if (dbFiles.length > 0) {
                                        dbFiles.forEach(fileName => {
                                            const ytext = ydocRef.current.getText(fileName);
                                            if (ytext.length === 0) {
                                                ytext.insert(0, loadedFilesRef.current[fileName]);
                                            }
                                        });
                                    } else {
                                        const ytext = ydocRef.current.getText("src/Main.java");
                                        if (ytext.length === 0) {
                                            ytext.insert(0, CODE_SNIPPETS["java"]);
                                        }
                                    }
                                });
                            } else {
                                client.send(`/app/yjs/${roomId}`, {}, JSON.stringify({ sender: username, type: 'REQUEST_SYNC' }));
                                
                                setTimeout(() => {
                                    if (ydocRef.current.getText(activeFile || "src/Main.java").length === 0) {
                                        ydocRef.current.transact(() => {
                                            const dbFiles = Object.keys(loadedFilesRef.current);
                                            if (dbFiles.length > 0) {
                                                dbFiles.forEach(fileName => {
                                                    const ytext = ydocRef.current.getText(fileName);
                                                    if (ytext.length === 0) {
                                                        ytext.insert(0, loadedFilesRef.current[fileName]);
                                                    }
                                                });
                                            } else {
                                                const ytext = ydocRef.current.getText("src/Main.java");
                                                if (ytext.length === 0) {
                                                    ytext.insert(0, CODE_SNIPPETS["java"]);
                                                }
                                            }
                                        });
                                    }
                                }, 3000);
                            }
                            ydocInitialized.current = true;
                        }
                    }

                    if (body.type === 'KICK') {
                        if (body.username === username) {
                            toast.error("You have been kicked from the room by the host.", { icon: '🥾', duration: 5000 });
                            window.location.href = '/';
                            return;
                        } else {
                            toast(`${body.username} was kicked by the host.`);
                        }
                    } else if (body.username !== username) {
                        const toastKey = `${body.type}-${body.username}`;
                        if (!notifiedUsers.current.has(toastKey)) {
                            if (body.type === "JOIN") toast.success(`${body.username} joined`);
                            if (body.type === "LEAVE") toast(`${body.username} left`);
                            if (body.type === "ROLE_UPDATE") toast(`${body.username}'s role was updated`);
                            notifiedUsers.current.add(toastKey);
                            setTimeout(() => notifiedUsers.current.delete(toastKey), 4000);
                        }
                    }
                    if (body.users) {
                        body.users.forEach(u => getUserColor(u.username));
                        setUsers(body.users);
                        const me = body.users.find(u => u.username === username);
                        if (me) setCurrentUserRole(me.role);
                        const activeUsernames = body.users.map(u => u.username);
                        Object.keys(remoteCursors.current).forEach(u => {
                            if (!activeUsernames.includes(u)) {
                                if (editorRef.current) editorRef.current.removeContentWidget(remoteCursors.current[u]);
                                delete remoteCursors.current[u];
                            }
                        });
                    }
                });

                client.subscribe(`/topic/chat/${roomId}`, (msg) => { setMessages(prev => [...prev, JSON.parse(msg.body)]); });
                client.subscribe(`/topic/typing/${roomId}`, (msg) => {
                    const body = JSON.parse(msg.body);
                    if (body.username !== username) {
                        setTypingUsers(prev => {
                            const s = new Set(prev);
                            body.isTyping === 'true' ? s.add(body.username) : s.delete(body.username);
                            return Array.from(s);
                        });
                    }
                });
                client.subscribe(`/topic/cursor/${roomId}`, (msg) => {
                    const body = JSON.parse(msg.body);
                    updateRemoteCursor(body.username, { lineNumber: body.lineNumber, column: body.column }, body.fileName || activeFile);
                });
                
                client.send(`/app/room/${roomId}/join`, {}, JSON.stringify({ username, type: "JOIN" }));
                
            }, () => {
                isConnected.current = false; setWsConnected(false); stompClient.current = null;
                reconnectTimeout = setTimeout(connectToSocket, 3000);
            });
        };
        connectToSocket();

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            clearTimeout(reconnectTimeout);
            disconnectTimeoutRef.current = setTimeout(() => {
                if (stompClient.current?.connected) {
                    stompClient.current.send(`/app/room/${roomId}/leave`, {}, JSON.stringify({ username, type: "LEAVE" }));
                    stompClient.current.disconnect();
                }
                isConnected.current = false; setWsConnected(false); stompClient.current = null;
            }, 200);
        };
    }, [roomId, username, navigate, isWorkspaceLoaded]); 

    useEffect(() => {
        if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }, [messages, typingUsers]);

    const handleFileOpen = (fileName) => {
        if (!openFiles.includes(fileName)) setOpenFiles(prev => [...prev, fileName]);
        setActiveFile(fileName);
    };

    const handleCloseTab = (e, fileName) => {
        e.stopPropagation();
        const newOpenFiles = openFiles.filter(f => f !== fileName);
        setOpenFiles(newOpenFiles);
        if (activeFile === fileName) setActiveFile(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null);
    };

    const handleCreateNewFile = () => {
        if (!canEdit) return;
        if (!newFileName.trim()) { toast.error("File name cannot be empty"); return; }
        
        let name = newFileName.trim();
        const requiredExt = `.${getExtension(newFileLang)}`;
        
        if (!name.endsWith(requiredExt)) {
            if (!name.includes('.')) {
                name += requiredExt; 
            } else {
                const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
                name = nameWithoutExt + requiredExt;
            }
        }

        const initialCode = CODE_SNIPPETS[newFileLang] || `// Start coding in ${name}...`;
        
        ydocRef.current.transact(() => {
            ydocRef.current.getText(name).insert(0, initialCode);
        });

        setFiles(prev => ({ ...prev, [name]: { name, language: newFileLang } }));
        if (!openFiles.includes(name)) setOpenFiles(prev => [...prev, name]);
        setActiveFile(name);
        
        if (stompClient.current?.connected) {
            stompClient.current.send(`/app/code/${roomId}`, {}, JSON.stringify({ sender: username, language: newFileLang, type: "METADATA", fileName: name }));
        }
        setIsModalOpen(false); setNewFileName("");
    };

    const handleFileUpload = (e) => {
        if (!canEdit) return;
        const uploadedFiles = Array.from(e.target.files);
        if (uploadedFiles.length === 0) return;

        let lastFileName = "";
        let uploadedCount = 0;
        const allowedExtensions = ['.java', '.py', '.cpp', '.js', '.ts', '.go', '.rs', '.md', '.txt'];

        uploadedFiles.forEach(file => {
            const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
            if (!allowedExtensions.includes(ext)) {
                toast.error(`Skipped ${file.name}: Please upload a supported file (.java, .py, .cpp, .js, .ts, .go, .rs, .md, .txt)`, { duration: 4000, icon: '🚫' });
                return; 
            }

            const name = `src/${file.name}`; 
            const language = getLanguageFromExtension(name);
            uploadedCount++;

            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target.result;
                
                ydocRef.current.transact(() => {
                    const ytext = ydocRef.current.getText(name);
                    if (ytext.length > 0) ytext.delete(0, ytext.length); 
                    ytext.insert(0, content);
                });

                setFiles(prev => ({ ...prev, [name]: { name, language } }));
                if (!openFiles.includes(name)) setOpenFiles(prev => [...prev, name]);
                lastFileName = name;

                if (stompClient.current?.connected) {
                    stompClient.current.send(`/app/code/${roomId}`, {}, JSON.stringify({ sender: username, language: language, type: "METADATA", fileName: name }));
                }
            };
            reader.readAsText(file);
        });

        setTimeout(() => {
            if (lastFileName) setActiveFile(lastFileName);
        }, 100);

        setIsModalOpen(false);
        if (uploadedCount > 0) {
            toast.success(`${uploadedCount} file(s) uploaded!`, { icon: '📁' });
        }
        e.target.value = null; 
    };

    const handleDeleteIconClick = (e, fileName) => {
        e.stopPropagation();
        if (!canEdit) { toast.error("You are in read-only mode"); return; }
        if (Object.keys(files).length === 1) { toast.error("Cannot delete the last file.", { icon: '⚠️' }); return; }
        setFileToDelete(fileName); setIsDeleteModalOpen(true);
    };

    const confirmDeleteFile = () => {
        if (!fileToDelete || !canEdit) return;
        
        ydocRef.current.transact(() => {
            const ytext = ydocRef.current.getText(fileToDelete);
            if (ytext.length > 0) {
                ytext.delete(0, ytext.length);
            }
        });

        setFiles(prev => { const n = { ...prev }; delete n[fileToDelete]; return n; });
        setOpenFiles(prev => {
            const n = prev.filter(f => f !== fileToDelete);
            if (activeFile === fileToDelete) setActiveFile(n.length > 0 ? n[n.length - 1] : null);
            return n;
        });
        setEditorErrors(prev => { const n = { ...prev }; delete n[fileToDelete]; return n; });
        
        if (stompClient.current?.connected) {
            stompClient.current.send(`/app/code/${roomId}`, {}, JSON.stringify({ sender: username, type: "DELETE", fileName: fileToDelete }));
        }
        
        toast.success(`${fileToDelete} deleted`);
        setIsDeleteModalOpen(false); 
        setFileToDelete(null);
    };

    const handleLanguageSelect = (e) => {
        if (!isHost || !activeFile) return;
        const newLang = e.target.value;
        const newCode = CODE_SNIPPETS[newLang];
        
        ydocRef.current.transact(() => {
            const ytext = ydocRef.current.getText(activeFile);
            ytext.delete(0, ytext.length);
            ytext.insert(0, newCode);
        });

        setFiles(prev => ({ ...prev, [activeFile]: { ...prev[activeFile], language: newLang } }));
        setEditorErrors(prev => { const n = { ...prev }; delete n[activeFile]; return n; });
        if (stompClient.current?.connected) {
            stompClient.current.send(`/app/code/${roomId}`, {}, JSON.stringify({ sender: username, language: newLang, type: "METADATA", fileName: activeFile }));
        }
    };

    const handleEditorChange = () => {};

    const handleTypingChange = (e) => {
        setChatMsg(e.target.value);
        if (stompClient.current?.connected) {
            stompClient.current.send(`/app/typing/${roomId}`, {}, JSON.stringify({ username, isTyping: 'true' }));
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                if (stompClient.current?.connected) stompClient.current.send(`/app/typing/${roomId}`, {}, JSON.stringify({ username, isTyping: 'false' }));
            }, 1500);
        }
    };

    const sendChat = () => {
        if (chatMsg.trim() && stompClient.current?.connected) {
            stompClient.current.send(`/app/chat/${roomId}`, {}, JSON.stringify({ sender: username, content: chatMsg }));
            setChatMsg(""); clearTimeout(typingTimeoutRef.current);
            stompClient.current.send(`/app/typing/${roomId}`, {}, JSON.stringify({ username, isTyping: 'false' }));
        }
    };

    const formatCode = () => {
        if (!canEdit || !activeFile) return;
        if (editorRef.current) {
            editorRef.current.getAction('editor.action.formatDocument').run();
            if (['javascript', 'typescript'].includes(files[activeFile]?.language)) toast.success("Code formatted!");
            else toast("Native formatting is only available for JS/TS.", { icon: 'ℹ️' });
        }
    };

    const runCode = async () => {
        if (!activeFile) return;
        setIsRunning(true);
        setOutput("Running...");
        setEditorErrors({});
        try {
            const fileData = {};
            Object.keys(files).forEach(key => { fileData[key] = ydocRef.current.getText(key).toString(); });
            const envVarsPayload = secrets.reduce((acc, curr) => {
                if (curr.key.trim() && curr.value.trim()) acc[curr.key.trim()] = curr.value.trim();
                return acc;
            }, {});
            const response = await axios.post(`${API_BASE_URL}/api/execute`, {
                language: files[activeFile].language,
                code: ydocRef.current.getText(activeFile).toString(),
                input: userInput,
                mainFile: activeFile,
                files: fileData,
                envVars: envVarsPayload
            });
            const outputText = response.data;
            setOutput(outputText);

            const parsed = parseErrors(outputText, files[activeFile].language, files);
            if (parsed.length > 0) {
                const byFile = {};
                parsed.forEach(err => {
                    if (!byFile[err.fileName]) byFile[err.fileName] = [];
                    byFile[err.fileName].push(err);
                });
                setEditorErrors(byFile);
                const errCount = parsed.filter(e => e.severity === 'error').length;
                const warnCount = parsed.filter(e => e.severity === 'warning').length;
                if (errCount > 0) toast.error(`${errCount} error${errCount > 1 ? 's' : ''} found`, { icon: '🔴' });
                else if (warnCount > 0) toast(`${warnCount} warning${warnCount > 1 ? 's' : ''}`, { icon: '🟡' });
            }
        } catch (error) {
            setOutput("Execution failed.");
        } finally {
            setIsRunning(false);
        }
    };

    const saveWorkspace = async () => {
        if (!isHost) return;
        setIsSaving(true);
        try {
            const fileData = {};
            Object.keys(files).forEach(key => { fileData[key] = ydocRef.current.getText(key).toString(); });
            await axios.post(`${API_BASE_URL}/api/workspace/${roomId}/save?username=${encodeURIComponent(username)}&roomName=${encodeURIComponent(roomName)}`, fileData);
            toast.success("Workspace saved to cloud! ☁️");
        } catch (error) {
            toast.error(error.response?.data || "Failed to save workspace.");
        } finally { setIsSaving(false); }
    };

    const downloadWorkspace = async () => {
        try {
            const zip = new JSZip();
            Object.keys(files).forEach(fileName => { zip.file(fileName, ydocRef.current.getText(fileName).toString()); });
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `${roomName.replace(/[^a-zA-Z0-9]/g, '_')}_vylop.zip`);
            toast.success("Workspace Exported! 📦");
        } catch (error) { toast.error("Failed to export workspace"); }
    };

    const copyRoomLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
        toast.success("Invite Link Copied!", { icon: '🔗' });
    };

    const handleJumpToLine = (fileName, lineNumber) => {
        if (files[fileName]) {
            if (activeFile !== fileName) handleFileOpen(fileName);
            setTimeout(() => {
                if (editorRef.current) {
                    editorRef.current.revealLineNearTop(lineNumber);
                    editorRef.current.setPosition({ lineNumber, column: 1 });
                    editorRef.current.focus();
                }
            }, 50);
        } else {
            toast.error(`File ${fileName} not found.`);
        }
    };

    const renderFormattedOutput = (text) => {
        if (!text) return "// Run code to see output...";
        const lines = text.split('\n');
        return lines.map((line, index) => {
            const isError = /(error|exception|traceback|failed|at\s+[\w.]+\.)/i.test(line);
            const style = isError ? { color: '#ff6b6b' } : { color: '#e1e4e8' };
            const match1 = line.match(/([a-zA-Z0-9_/\\-]+\.[a-zA-Z0-9]+):(\d+)/);
            const match2 = line.match(/File "([^"]+)", line (\d+)/);
            const match = match1 || match2;
            if (match) {
                const fullMatch = match[0];
                const rawFile = match[1];
                const lineNumber = parseInt(match[2], 10);
                const resolvedFile = resolveFileName(rawFile, files);
                const parts = line.split(fullMatch);
                return (
                    <div key={index} style={{ ...style, fontFamily: 'JetBrains Mono, monospace', lineHeight: '1.5' }}>
                        {parts[0]}
                        <span onClick={() => handleJumpToLine(resolvedFile, lineNumber)}
                            style={{ textDecoration: 'underline', cursor: 'pointer', color: '#58a6ff', fontWeight: 'bold' }}
                            title={`Jump to line ${lineNumber} in ${resolvedFile}`}>
                            {fullMatch}
                        </span>
                        {parts[1]}
                    </div>
                );
            }
            return <div key={index} style={{ ...style, fontFamily: 'JetBrains Mono, monospace', lineHeight: '1.5' }}>{line}</div>;
        });
    };

    const renderTabName = (filePath) => {
        const fileName = filePath.split('/').pop();
        const duplicates = openFiles.filter(p => p.split('/').pop() === fileName);
        const fileErrors = editorErrors[filePath] || [];
        const errorCount = fileErrors.filter(e => e.severity === 'error').length;
        const warnCount = fileErrors.filter(e => e.severity === 'warning').length;

        const badge = errorCount > 0 ? (
            <span style={{ marginLeft: '5px', background: '#ff6b6b', color: '#fff', borderRadius: '8px', fontSize: '0.6rem', padding: '0 5px', fontWeight: 'bold', lineHeight: '16px', flexShrink: 0 }}>
                {errorCount}
            </span>
        ) : warnCount > 0 ? (
            <span style={{ marginLeft: '5px', background: '#f0883e', color: '#fff', borderRadius: '8px', fontSize: '0.6rem', padding: '0 5px', fontWeight: 'bold', lineHeight: '16px', flexShrink: 0 }}>
                {warnCount}
            </span>
        ) : null;

        if (duplicates.length > 1) {
            const parts = filePath.split('/');
            if (parts.length > 1) {
                return (
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                        {fileName}
                        <span style={{ fontSize: '0.85em', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 'normal' }}>{parts[parts.length - 2]}/</span>
                        {badge}
                    </span>
                );
            }
        }
        return <span style={{ display: 'flex', alignItems: 'center' }}>{fileName}{badge}</span>;
    };

    const activeFileErrors = editorErrors[activeFile] || [];

    // Dynamically calculate sizes. If there's a problem loaded, it becomes a 3-way split
    const splitSizes = currentProblem ? [30, 45, 25] : [70, 30];

    return (
        <div className="app-container">

            {/* LEAVE CONFIRMATION MODAL */}
            {isLeaveModalOpen && (
                <div className="modal-overlay" style={{ zIndex: 2000 }}>
                    <div className="custom-modal" style={{ width: '420px' }}>
                        <h3 style={{ margin: '0 0 15px 0' }}>Leave Workspace</h3>
                        <p style={{color: 'var(--text-muted)', fontSize: '0.95rem', margin: '5px 0 20px 0', lineHeight: '1.5'}}>
                            Do you want to explicitly save this workspace to the cloud before you leave? <br/><br/>
                            If you leave without saving, this temporary room and all its files will be permanently discarded.
                        </p>
                        <div className="modal-actions" style={{ flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                            <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} onClick={async () => { 
                                await saveWorkspace(); 
                                navigate('/'); 
                            }}>Save & Leave</button>
                            
                            <button className="btn btn-danger" style={{ width: '100%', padding: '12px' }} onClick={async () => {
                                try {
                                    await axios.delete(`${API_BASE_URL}/api/workspace/${roomId}/delete?username=${encodeURIComponent(username)}`);
                                    toast.success("Temporary workspace discarded.");
                                } catch (e) { console.error(e); }
                                navigate('/');
                            }}>Leave Without Saving (Discard Room)</button>
                            
                            <button className="btn btn-secondary" style={{ width: '100%', padding: '12px' }} onClick={() => setIsLeaveModalOpen(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {isSecretsModalOpen && (
                <div className="modal-overlay">
                    <div className="custom-modal" style={{ width: '450px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                Environment Secrets
                            </h3>
                            <button className="btn btn-icon" onClick={() => setIsSecretsModalOpen(false)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>&times;</button>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.4' }}>
                            Add environment variables here. They will be securely injected when you run your code and won't be saved in your files.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', marginBottom: '15px', paddingRight: '5px' }}>
                            {secrets.map((secret, index) => (
                                <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input type="text" className="modal-input modern-input" placeholder="KEY" value={secret.key}
                                        onChange={(e) => { const n = [...secrets]; n[index].key = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''); setSecrets(n); }}
                                        style={{ flex: 1, fontSize: '0.85rem' }} />
                                    <input type="password" className="modal-input modern-input" placeholder="VALUE" value={secret.value}
                                        onChange={(e) => { const n = [...secrets]; n[index].value = e.target.value; setSecrets(n); }}
                                        style={{ flex: 1, fontSize: '0.85rem' }} />
                                    <button className="btn btn-icon" onClick={() => { const n = secrets.filter((_, i) => i !== index); setSecrets(n.length ? n : [{ key: '', value: '' }]); }}
                                        style={{ color: '#ff6b6b', background: 'transparent', padding: '4px' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button className="btn btn-secondary" onClick={() => setSecrets([...secrets, { key: '', value: '' }])} style={{ width: '100%', marginBottom: '20px', fontSize: '0.85rem' }}>+ Add Variable</button>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setIsSecretsModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={() => { toast.success("Secrets ready!", { icon: '🔒' }); setIsSecretsModalOpen(false); }}>Done</button>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="custom-modal">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0 }}>Add File</h3>
                            <button className="btn btn-icon" onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>&times;</button>
                        </div>

                        <div className="modal-field">
                            <label>Language</label>
                            <select className="modal-input modern-input" value={newFileLang} onChange={(e) => { setNewFileLang(e.target.value); if (!newFileName || newFileName.includes('.')) setNewFileName(`src/NewFile.${getExtension(e.target.value)}`); }}>
                                <option value="java">Java</option><option value="python">Python</option><option value="cpp">C++</option>
                                <option value="javascript">JavaScript</option><option value="typescript">TypeScript</option>
                                <option value="go">Go</option><option value="rust">Rust</option><option value="markdown">Markdown</option>
                            </select>
                        </div>
                        <div className="modal-field">
                            <label>File Name</label>
                            <input type="text" className="modal-input modern-input" value={newFileName} onChange={(e) => setNewFileName(e.target.value)}
                                placeholder={`e.g. src/utils/script.${getExtension(newFileLang)}`} onKeyDown={(e) => e.key === 'Enter' && handleCreateNewFile()} autoFocus />
                        </div>
                        <div className="modal-actions" style={{ marginBottom: '15px' }}>
                            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleCreateNewFile}>Create New File</button>
                        </div>

                        <div style={{ margin: '15px 0', borderBottom: '1px solid var(--border)', textAlign: 'center', lineHeight: '0.1em' }}>
                            <span style={{ background: 'var(--bg-overlay)', padding: '0 10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>OR</span>
                        </div>

                        <div className="modal-field" style={{ textAlign: 'center' }}>
                            <input 
                                type="file" 
                                multiple 
                                accept=".java,.py,.cpp,.js,.ts,.go,.rs,.md,.txt"
                                ref={fileInputRef} 
                                style={{ display: 'none' }} 
                                onChange={handleFileUpload} 
                            />
                            <button className="btn btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} onClick={() => fileInputRef.current.click()}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Upload File(s) from Computer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && (
                <div className="modal-overlay">
                    <div className="custom-modal">
                        <h3>Delete File</h3>
                        <p style={{color: 'var(--text-muted)', fontSize: '0.9rem', margin: '5px 0 15px 0', lineHeight: '1.4'}}>
                            Are you sure you want to delete <strong>{fileToDelete}</strong>?<br/><br/>
                            This action cannot be undone and will delete the file for everyone in the room.
                        </p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
                            <button className="btn btn-danger" onClick={confirmDeleteFile}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* SIDEBAR */}
            <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="sidebar-header" style={{ flexShrink: 0 }}>
                    <div className="brand-logo">
                        <span className="brand-prompt">&gt;</span><span>Vylop</span><span className="brand-cursor"></span>
                    </div>
                    <button className="btn btn-secondary btn-icon" onClick={() => setIsSidebarOpen(false)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div style={{ padding: '12px 15px 4px', fontSize: '0.7rem', color: '#8b949e', letterSpacing: '1px', flexShrink: 0 }}>EXPLORER</div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Files Panel */}
                    <div style={{ display: 'flex', flexDirection: 'column', flex: isExplorerExpanded ? '1 1 0%' : '0 0 auto', minHeight: 0 }}>
                        <div onClick={() => setIsExplorerExpanded(!isExplorerExpanded)}
                            style={{ padding: '4px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '0.5px', textTransform: 'uppercase', userSelect: 'none' }}>
                            <svg style={{ marginRight: '4px', transform: isExplorerExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.1s' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            FILES
                        </div>
                        {isExplorerExpanded && (
                            <div style={{ overflowY: 'auto', flex: 1, paddingBottom: '10px' }}>
                                <FileExplorer files={files} activeFile={activeFile} onFileClick={handleFileOpen} />
                            </div>
                        )}
                    </div>

                    {/* Online Users Panel */}
                    <div style={{ display: 'flex', flexDirection: 'column', flex: isOnlineExpanded ? '0 1 auto' : '0 0 auto', maxHeight: '35%', minHeight: 0 }}>
                        <div onClick={() => setIsOnlineExpanded(!isOnlineExpanded)}
                            style={{ padding: '4px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '0.5px', textTransform: 'uppercase', userSelect: 'none', borderTop: '1px solid transparent' }}>
                            <div style={{display: 'flex', alignItems: 'center'}}>
                                <svg style={{ marginRight: '4px', transform: isOnlineExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.1s' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                ONLINE ({users.length})
                            </div>
                            <span className={`status-dot ${wsConnected ? 'connected' : 'disconnected'}`}></span>
                        </div>
                        {isOnlineExpanded && (
                            <div className="users-container" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 15px' }}>
                                {users.map((u, i) => (
                                    <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '30px', height: '30px', borderRadius: '6px', backgroundColor: getUserColor(u.username), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff', fontSize: '14px', flexShrink: 0 }}>
                                                {u.username.charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#e1e4e8', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</span>
                                                    <span style={{ width: '6px', height: '6px', backgroundColor: '#2ea043', borderRadius: '50%', flexShrink: 0 }}></span>
                                                </div>
                                                <span style={{ fontSize: '0.6rem', fontWeight: '700', padding: '2px 4px', borderRadius: '3px', backgroundColor: u.role === 'HOST' ? 'rgba(210,153,34,0.15)' : u.role === 'EDITOR' ? 'rgba(46,160,67,0.15)' : 'rgba(139,148,158,0.15)', color: u.role === 'HOST' ? '#d29922' : u.role === 'EDITOR' ? '#3fb950' : '#8b949e' }}>{u.role}</span>
                                            </div>
                                        </div>
                                        {isHost && u.username !== username && (
                                            <div style={{ display: 'flex', gap: '6px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                                                {u.role === 'READ_ONLY'
                                                    ? <button onClick={() => changeUserRole(u.username, 'EDITOR')} style={{ flex: 1, fontSize: '0.7rem', padding: '4px', background: 'rgba(46,160,67,0.1)', color: '#3fb950', border: '1px solid rgba(46,160,67,0.3)', borderRadius: '4px', cursor: 'pointer' }}>↑ Promote</button>
                                                    : <button onClick={() => changeUserRole(u.username, 'READ_ONLY')} style={{ flex: 1, fontSize: '0.7rem', padding: '4px', background: 'rgba(210,153,34,0.1)', color: '#d29922', border: '1px solid rgba(210,153,34,0.3)', borderRadius: '4px', cursor: 'pointer' }}>↓ Demote</button>
                                                }
                                                <button onClick={() => kickTargetUser(u.username)} style={{ flex: 0.6, fontSize: '0.7rem', padding: '4px', background: 'rgba(218,54,51,0.1)', color: '#da3633', border: '1px solid rgba(218,54,51,0.3)', borderRadius: '4px', cursor: 'pointer' }}>✕ Kick</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Chat Panel */}
                    <div style={{ display: 'flex', flexDirection: 'column', flex: isChatExpanded ? '1 1 0%' : '0 0 auto', minHeight: 0 }}>
                        <div onClick={() => setIsChatExpanded(!isChatExpanded)}
                            style={{ padding: '4px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '0.5px', textTransform: 'uppercase', userSelect: 'none', borderTop: '1px solid transparent' }}>
                            <svg style={{ marginRight: '4px', transform: isChatExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.1s' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            CHAT
                        </div>
                        {isChatExpanded && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div className="chat-messages" ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 15px' }}>
                                    {messages.map((msg, i) => (
                                        <div key={i} className={`message ${msg.sender === username ? 'self' : 'other'}`}>
                                            <span className="msg-meta">{msg.sender}</span>
                                            <div className="msg-bubble">{msg.content}</div>
                                        </div>
                                    ))}
                                </div>
                                {typingUsers.length > 0 && (
                                    <div style={{ padding: '0 15px 5px', fontSize: '0.75rem', color: '#8b949e', fontStyle: 'italic', flexShrink: 0 }}>
                                        {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                                    </div>
                                )}
                                <div className="chat-input-area" style={{ padding: '10px 15px', flexShrink: 0 }}>
                                    <input className="modern-input" value={chatMsg} onChange={handleTypingChange} onKeyDown={(e) => e.key === 'Enter' && sendChat()} placeholder="Type a message..." />
                                    <button className="btn btn-primary btn-icon" onClick={sendChat}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ flexShrink: 0, marginTop: 'auto', borderTop: '1px solid var(--border)', padding: '15px', display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" style={{flex:1, padding: '8px', fontSize: '0.85rem'}} onClick={copyRoomLink}>Copy Link</button>
                    <button className="btn btn-danger" style={{flex:1, padding: '8px', fontSize: '0.85rem'}} onClick={() => isHost ? setIsLeaveModalOpen(true) : navigate('/')}>Leave</button>
                </div>
            </div>

            {/* MAIN AREA */}
            <div className="main-area">
                <div className="toolbar">
                    <div className="toolbar-group">
                        <button className="btn btn-secondary btn-icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <span style={{fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)'}}>{roomName}</span>
                    </div>
                    <div className="toolbar-group right-controls">
                        
                        {/* ─── NEW: TEMPORARY QUESTION BANK TOGGLE (HOST ONLY) ─── */}
                        {isHost && (
                            <button className={`btn btn-icon ${currentProblem ? 'btn-primary' : 'btn-secondary'}`} 
                                    onClick={() => setCurrentProblem(currentProblem ? null : MOCK_PROBLEMS["two-sum"])} 
                                    title="Toggle Problem Bank (Test)" 
                                    style={{marginRight: '10px'}}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </button>
                        )}

                        {files[activeFile]?.language === "markdown" && (
                            <button className={`btn btn-icon ${showMarkdownPreview ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowMarkdownPreview(!showMarkdownPreview)} title="Toggle Markdown Preview" style={{marginRight: '10px'}}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                        )}
                        <button className={`btn btn-secondary btn-icon ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => canEdit && setIsModalOpen(true)} title={!canEdit ? getTooltip('EDITOR') : "Add File"} disabled={!canEdit}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
                        </button>
                        <button className={`btn btn-secondary btn-icon ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => canEdit && setIsSecretsModalOpen(true)} title={!canEdit ? getTooltip('EDITOR') : "Environment Secrets"} disabled={!canEdit}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </button>
                        <button className={`btn btn-secondary btn-icon ${(!isHost || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => isHost && saveWorkspace()} disabled={!isHost || isSaving} title={!isHost ? getTooltip('HOST') : "Save to Cloud"}>
                            {isSaving ? <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>}
                        </button>
                        <button className="btn btn-secondary btn-icon" onClick={downloadWorkspace} title="Export as .zip">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </button>
                        <div className="toolbar-divider"></div>
                        <button className={`btn btn-secondary btn-icon ${(!canEdit || !activeFile) ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={(e) => canEdit && activeFile && handleDeleteIconClick(e, activeFile)} disabled={!canEdit || !activeFile} title={!canEdit ? getTooltip('EDITOR') : "Delete Current File"}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                        <button className={`btn btn-secondary btn-icon ${(!canEdit || !activeFile) ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => canEdit && activeFile && formatCode()} disabled={!canEdit || !activeFile} title={!canEdit ? getTooltip('EDITOR') : "Format Code"}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>
                        </button>
                        <button className={`btn btn-icon ${isVimMode ? 'btn-primary' : 'btn-secondary'}`} onClick={toggleVimMode} title={isVimMode ? "Disable Vim Mode" : "Enable Vim Mode"}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                        </button>
                        <div className="toolbar-divider"></div>
                        <select className="lang-select" value={editorTheme} onChange={handleThemeChange} title="Select Theme" style={{marginRight: '10px'}}>
                            <option value="vs-dark">Dark Theme</option>
                            <option value="light">Light Theme</option>
                            <option value="hc-black">High Contrast</option>
                        </select>
                        <select className={`lang-select ${(!isHost || !activeFile) ? 'opacity-50 cursor-not-allowed' : ''}`} value={activeFile ? files[activeFile]?.language : "java"} onChange={handleLanguageSelect} disabled={!isHost || !activeFile} title={!isHost ? getTooltip('HOST') : "Select Language"}>
                            <option value="java">Java</option><option value="python">Python</option><option value="cpp">C++</option>
                            <option value="javascript">JavaScript</option><option value="typescript">TypeScript</option>
                            <option value="go">Go</option><option value="rust">Rust</option><option value="markdown">Markdown</option>
                        </select>
                        <button className="btn btn-primary btn-icon" onClick={runCode} disabled={isRunning || !activeFile} title="Run Code">
                            {isRunning ? <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
                        </button>
                    </div>
                </div>

                {/* File Tabs */}
                <div className="file-tabs">
                    {openFiles.map((fileName) => (
                        <div key={fileName} className={`file-tab ${activeFile === fileName ? 'active' : ''}`} onClick={() => setActiveFile(fileName)}>
                            <span className="file-tab-name" style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                                {getFileIcon(fileName.split('/').pop())}
                                {renderTabName(fileName)}
                            </span>
                            <span className="file-tab-close" onClick={(e) => handleCloseTab(e, fileName)} title="Close Tab">&times;</span>
                        </div>
                    ))}
                </div>

                {!activeFile ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)', color: 'var(--text-muted)' }}>
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{opacity: 0.3, marginBottom: '20px'}}><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                        <h3>Vylop Editor</h3>
                        <p style={{fontSize: '0.9rem', marginTop: '10px'}}>Select a file from the explorer to start coding.</p>
                    </div>
                ) : (
                    <Split className={`editor-split ${splitDirection}`} sizes={currentProblem ? [30, 45, 25] : [70, 30]} minSize={250} gutterSize={8} direction={splitDirection}>
                        
                        {/* ─── PROBLEM DESCRIPTION PANEL ─── */}
                        {currentProblem && (
                            <div className="problem-wrapper" style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-dark)', color: 'var(--text-main)', height: '100%', overflowY: 'auto', padding: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                                    <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{currentProblem.title}</h2>
                                    <span style={{ 
                                        padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px',
                                        backgroundColor: currentProblem.difficulty === 'Easy' ? 'rgba(46,160,67,0.15)' : currentProblem.difficulty === 'Medium' ? 'rgba(210,153,34,0.15)' : 'rgba(218,54,51,0.15)',
                                        color: currentProblem.difficulty === 'Easy' ? '#3fb950' : currentProblem.difficulty === 'Medium' ? '#d29922' : '#da3633'
                                    }}>
                                        {currentProblem.difficulty}
                                    </span>
                                </div>
                                
                                <div className="markdown-preview" style={{ fontSize: '0.95rem', lineHeight: '1.6', borderBottom: '1px solid var(--border)', paddingBottom: '15px' }}>
                                    <ReactMarkdown>{currentProblem.description}</ReactMarkdown>
                                </div>
                                
                                <div style={{ marginTop: '20px' }}>
                                    {currentProblem.examples.map((ex, i) => (
                                        <div key={i} style={{ marginBottom: '20px' }}>
                                            <strong style={{ fontSize: '0.9rem', color: '#e1e4e8' }}>Example {i + 1}:</strong>
                                            <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderLeft: '3px solid var(--border)', padding: '12px', borderRadius: '0 8px 8px 0', marginTop: '8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>
                                                <div style={{ marginBottom: '4px' }}><span style={{ opacity: 0.6 }}>Input:</span> <span style={{ color: '#e1e4e8' }}>{ex.input}</span></div>
                                                <div style={{ marginBottom: ex.explanation ? '4px' : '0' }}><span style={{ opacity: 0.6 }}>Output:</span> <span style={{ color: '#e1e4e8' }}>{ex.output}</span></div>
                                                {ex.explanation && <div><span style={{ opacity: 0.6 }}>Explanation:</span> <span style={{ color: '#e1e4e8' }}>{ex.explanation}</span></div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                <div style={{ marginTop: '10px' }}>
                                    <strong style={{ fontSize: '0.9rem', color: '#e1e4e8' }}>Constraints:</strong>
                                    <ul style={{ paddingLeft: '20px', marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        {currentProblem.constraints.map((c, i) => (
                                            <li key={i} style={{ marginBottom: '6px' }}>
                                                <code style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '3px 6px', borderRadius: '4px', color: '#e1e4e8', fontFamily: 'JetBrains Mono, monospace' }}>{c}</code>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        <div className="editor-wrapper" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                            {showMarkdownPreview && files[activeFile]?.language === "markdown" ? (
                                <Split className="markdown-split" sizes={[50, 50]} minSize={100} gutterSize={8} direction="horizontal" style={{ display: 'flex', flex: 1 }}>
                                    <div style={{ height: '100%' }}>
                                        <Editor path={activeFile} height="100%" language="markdown" theme={editorTheme} onMount={handleEditorDidMount} onChange={handleEditorChange} options={{ readOnly: !canEdit, domReadOnly: !canEdit, minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono', automaticLayout: true, wordWrap: 'on', hover: { above: false }, fixedOverflowWidgets: true }} />
                                    </div>
                                    <div className="markdown-preview" style={{ height: '100%', overflowY: 'auto', padding: '20px', backgroundColor: 'var(--bg-dark)', color: 'var(--text-main)' }}>
                                        <ReactMarkdown>{ydocRef.current.getText(activeFile).toString()}</ReactMarkdown>
                                    </div>
                                </Split>
                            ) : (
                                <div style={{ flex: 1, minHeight: 0, height: '100%' }}>
                                    <Editor path={activeFile} height="100%" language={files[activeFile]?.language === "cpp" ? "cpp" : files[activeFile]?.language} theme={editorTheme} onMount={handleEditorDidMount} onChange={handleEditorChange}
                                        options={{ readOnly: !canEdit, domReadOnly: !canEdit, minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono', automaticLayout: true, formatOnPaste: true, glyphMargin: true, hover: { above: false }, fixedOverflowWidgets: true }} />
                                </div>
                            )}
                            <div id="vim-status-bar" className="vim-status-bar"></div>

                            {/* Error Panel */}
                            {activeFileErrors.length > 0 && (
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '140px', overflowY: 'auto', backgroundColor: '#0d1117ee', borderTop: '1px solid #ff6b6b44', backdropFilter: 'blur(4px)', zIndex: 10 }}>
                                    <div style={{ padding: '4px 12px', fontSize: '0.65rem', color: '#ff6b6b', letterSpacing: '0.5px', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, backgroundColor: '#0d1117ee', zIndex: 1 }}>
                                        <span>
                                            {activeFileErrors.filter(e => e.severity === 'error').length > 0 && `🔴 ${activeFileErrors.filter(e => e.severity === 'error').length} error${activeFileErrors.filter(e => e.severity === 'error').length > 1 ? 's' : ''}`}
                                            {activeFileErrors.filter(e => e.severity === 'warning').length > 0 && `  🟡 ${activeFileErrors.filter(e => e.severity === 'warning').length} warning${activeFileErrors.filter(e => e.severity === 'warning').length > 1 ? 's' : ''}`}
                                        </span>
                                        <button onClick={() => setEditorErrors(prev => { const n = { ...prev }; delete n[activeFile]; return n; })}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}>
                                            ✕ Clear
                                        </button>
                                    </div>
                                    {activeFileErrors.map((err, i) => (
                                        <div key={i} onClick={() => handleJumpToLine(activeFile, err.line)}
                                            style={{ padding: '3px 12px', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'baseline', color: getSeverityColor(err.severity) }}
                                            title={`Jump to line ${err.line}`}>
                                            <span style={{ flexShrink: 0, opacity: 0.7 }}>Line {err.line}</span>
                                            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>—</span>
                                            <span>{err.message}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="io-wrapper">
                            <div className="io-container">
                                <div className="io-header"><span>STDIN (Input)</span></div>
                                <textarea className="terminal-input" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Enter input here..." />
                            </div>
                            <div className="io-container" style={{borderTop: '1px solid var(--border)'}}>
                                <div className="io-header">
                                    <span>STDOUT (Output)</span>
                                    <button className="btn btn-secondary" style={{fontSize: '0.7rem', height: '26px', padding: '0 8px'}} onClick={() => setOutput("")}>Clear</button>
                                </div>
                                <div className={`terminal-output ${!output ? 'placeholder' : ''}`} style={{ overflowY: 'auto', padding: '10px', height: '100%', backgroundColor: 'var(--bg-dark)' }}>
                                    {renderFormattedOutput(output)}
                                </div>
                            </div>
                        </div>
                    </Split>
                )}
            </div>
        </div>
    );
};

export default CodeEditor;