import React, { useState, useEffect, useRef } from 'react';
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
import Client from './Client';
import FileExplorer, { getFileIcon } from './FileExplorer';
import './CodeEditor.css'; 

// Production Backend URL
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

const CodeEditor = () => {
    const { roomId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [username] = useState(() => location.state?.username || localStorage.getItem('username') || '');
    const [roomName, setRoomName] = useState(() => location.state?.roomName || "Syncing Workspace...");

    const [files, setFiles] = useState({
        "src/Main.java": { name: "src/Main.java", language: "java", value: CODE_SNIPPETS["java"] }
    });
    const [openFiles, setOpenFiles] = useState(["src/Main.java"]);
    const [activeFile, setActiveFile] = useState("src/Main.java");
    
    const [output, setOutput] = useState("");
    const [userInput, setUserInput] = useState(""); 
    const [isRunning, setIsRunning] = useState(false);
    const [isSaving, setIsSaving] = useState(false); 

    const [users, setUsers] = useState([]); 
    const [currentUserRole, setCurrentUserRole] = useState('READ_ONLY');

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    
    // --- NEW: Sidebar Collapsible States ---
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

    const isHost = currentUserRole === 'HOST';
    const canEdit = currentUserRole === 'HOST' || currentUserRole === 'EDITOR';

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

    useEffect(() => {
        if (!username) {
            toast.error("Please login first");
            navigate('/auth');
        }
    }, [username, navigate]);

    useEffect(() => {
        let isMounted = true;

        const fetchWorkspaceData = async () => {
            if (loadedRooms.has(roomId)) return;
            loadedRooms.add(roomId);

            try {
                const metaRes = await axios.get(`${API_BASE_URL}/api/workspace/${roomId}`);
                if (isMounted && metaRes.data?.name) {
                    setRoomName(metaRes.data.name);
                }

                const response = await axios.get(`${API_BASE_URL}/api/workspace/${roomId}/load`);
                
                if (!isMounted) return;

                const loadedFiles = response.data;
                
                if (loadedFiles && Object.keys(loadedFiles).length > 0) {
                    const newFilesState = {};
                    Object.keys(loadedFiles).forEach(fileName => {
                        const content = loadedFiles[fileName];
                        const lang = getLanguageFromExtension(fileName);
                        newFilesState[fileName] = { name: fileName, language: lang, value: content };
                    });
                    
                    setFiles(newFilesState);
                    const firstFile = Object.keys(newFilesState)[0];
                    setActiveFile(firstFile);
                    setOpenFiles([firstFile]); 
                    
                    toast.success("Workspace synced", { icon: '☁️', id: 'workspace-loaded-toast' });
                }
            } catch (error) {
                if (isMounted) {
                    loadedRooms.delete(roomId);
                    setRoomName(prev => prev === "Syncing Workspace..." ? "Dev Workspace" : prev);
                    console.log("Sync error:", error);
                }
            }
        };

        if (roomId && username) fetchWorkspaceData();

        return () => {
            isMounted = false;
            loadedRooms.delete(roomId);
        };
    }, [roomId, username]);

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
            if (remoteCursors.current[user] && editorRef.current) {
                editorRef.current.removeContentWidget(remoteCursors.current[user]);
            }
            return;
        }

        if (!editorRef.current || !monacoRef.current) {
            pendingCursors.current[user] = { pos, file };
            return;
        }

        if (remoteCursors.current[user]) {
            editorRef.current.removeContentWidget(remoteCursors.current[user]);
        }

        const userColor = getUserColor(user);
        const lineHeight = editorRef.current.getOption(monacoRef.current.editor.EditorOption.lineHeight);

        const widgetId = `cursor-${user}`;
        const widget = {
            getId: () => widgetId,
            getDomNode: () => {
                const node = document.createElement('div');
                node.className = 'remote-cursor';
                node.style.height = `${lineHeight}px`;
                node.style.backgroundColor = userColor; 
                
                const label = document.createElement('div');
                label.className = 'remote-cursor-label';
                label.innerText = user;
                label.style.backgroundColor = userColor; 
                
                if (pos.lineNumber === 1) {
                    label.style.top = `${lineHeight}px`; 
                    label.style.borderRadius = '0 3px 3px 3px';
                } else {
                    label.style.top = '-20px'; 
                    label.style.borderRadius = '3px 3px 3px 0';
                }
                
                node.appendChild(label);
                return node;
            },
            getPosition: () => ({
                position: { lineNumber: pos.lineNumber, column: pos.column },
                preference: [monacoRef.current.editor.ContentWidgetPositionPreference.EXACT]
            })
        };

        editorRef.current.addContentWidget(widget);
        remoteCursors.current[user] = widget;
    };

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        window.monaco = monaco;

        Object.keys(pendingCursors.current).forEach(user => {
            if (pendingCursors.current[user].file === activeFile) {
                updateRemoteCursor(user, pendingCursors.current[user].pos, pendingCursors.current[user].file);
            }
        });
        pendingCursors.current = {}; 

        editor.onDidChangeCursorPosition((e) => {
            if (stompClient.current?.connected && activeFile) {
                stompClient.current.send(`/app/cursor/${roomId}`, {}, JSON.stringify({
                    username,
                    lineNumber: e.position.lineNumber,
                    column: e.position.column,
                    fileName: activeFile 
                }));
            }
        });
    };

    const toggleVimMode = () => {
        if (!editorRef.current) return;
        if (isVimMode) {
            if (vimInstanceRef.current) {
                vimInstanceRef.current.dispose();
                vimInstanceRef.current = null;
            }
            const statusNode = document.getElementById('vim-status-bar');
            if (statusNode) statusNode.innerHTML = '';
            setIsVimMode(false);
            toast("Vim Mode Disabled", { icon: '⌨️' });
        } else {
            const statusNode = document.getElementById('vim-status-bar');
            vimInstanceRef.current = initVimMode(editorRef.current, statusNode);
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

    useEffect(() => {
        if (!username) return;

        if (disconnectTimeoutRef.current) {
            clearTimeout(disconnectTimeoutRef.current);
            disconnectTimeoutRef.current = null;
        }

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

                client.subscribe(`/topic/code/${roomId}`, (msg) => {
                    const body = JSON.parse(msg.body);
                    
                    if (body.type === "DELETE") {
                        setFiles(prev => {
                            const newFiles = { ...prev };
                            delete newFiles[body.fileName];
                            return newFiles;
                        });
                        setOpenFiles(prev => {
                            const newOpenFiles = prev.filter(f => f !== body.fileName);
                            if (activeFile === body.fileName) {
                                setActiveFile(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null);
                            }
                            return newOpenFiles;
                        });

                        if (body.sender !== username) {
                            toast(`${body.sender} deleted ${body.fileName}`, { icon: '🗑️' });
                        }
                    } else if (body.sender !== username) {
                        setFiles(prev => ({
                            ...prev,
                            [body.fileName]: {
                                name: body.fileName,
                                language: body.language,
                                value: body.content
                            }
                        }));
                    }
                });

                client.subscribe(`/topic/users/${roomId}`, (msg) => {
                    const body = JSON.parse(msg.body);
                    
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
                        body.users.forEach(activeUserObj => getUserColor(activeUserObj.username));
                        setUsers(body.users);
                        
                        const me = body.users.find(u => u.username === username);
                        if (me) setCurrentUserRole(me.role);
                        
                        const activeUsernames = body.users.map(u => u.username);
                        Object.keys(remoteCursors.current).forEach(existingUser => {
                            if (!activeUsernames.includes(existingUser)) {
                                if (editorRef.current) editorRef.current.removeContentWidget(remoteCursors.current[existingUser]);
                                delete remoteCursors.current[existingUser];
                            }
                        });
                    }
                });

                client.subscribe(`/topic/chat/${roomId}`, (msg) => { setMessages(prev => [...prev, JSON.parse(msg.body)]); });
                client.subscribe(`/topic/typing/${roomId}`, (msg) => {
                    const body = JSON.parse(msg.body);
                    if (body.username !== username) {
                        setTypingUsers(prev => {
                            const newSet = new Set(prev);
                            body.isTyping === 'true' ? newSet.add(body.username) : newSet.delete(body.username);
                            return Array.from(newSet);
                        });
                    }
                });

                client.subscribe(`/topic/cursor/${roomId}`, (msg) => {
                    const body = JSON.parse(msg.body);
                    updateRemoteCursor(body.username, { lineNumber: body.lineNumber, column: body.column }, body.fileName || activeFile);
                });

                client.send(`/app/room/${roomId}/join`, {}, JSON.stringify({ username, type: "JOIN" }));
            }, (err) => {
                isConnected.current = false;
                setWsConnected(false);
                stompClient.current = null;
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
                isConnected.current = false;
                setWsConnected(false);
                stompClient.current = null;
            }, 200);
        };
    }, [roomId, username, navigate]); 

    useEffect(() => {
        if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }, [messages, typingUsers]);

    const handleFileOpen = (fileName) => {
        if (!openFiles.includes(fileName)) {
            setOpenFiles(prev => [...prev, fileName]);
        }
        setActiveFile(fileName);
    };

    const handleCloseTab = (e, fileName) => {
        e.stopPropagation();
        const newOpenFiles = openFiles.filter(f => f !== fileName);
        setOpenFiles(newOpenFiles);
        if (activeFile === fileName) {
            setActiveFile(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null);
        }
    };

    const handleCreateNewFile = () => {
        if (!canEdit) return; 
        if (!newFileName.trim()) {
            toast.error("File name cannot be empty");
            return;
        }

        const name = newFileName.trim();
        const lang = newFileLang;
        const initialCode = CODE_SNIPPETS[lang] || `// Welcome to Vylop!\n// Start coding in ${name}...`;

        const newFile = { name, language: lang, value: initialCode };
        
        setFiles(prev => ({ ...prev, [name]: newFile }));
        
        if (!openFiles.includes(name)) {
            setOpenFiles(prev => [...prev, name]);
        }
        setActiveFile(name);
        
        if (stompClient.current?.connected) {
            stompClient.current.send(`/app/code/${roomId}`, {}, JSON.stringify({ 
                sender: username, content: initialCode, language: lang, type: "CODE", fileName: name 
            }));
        }

        setIsModalOpen(false);
        setNewFileName("");
    };

    const handleDeleteIconClick = (e, fileName) => {
        e.stopPropagation(); 
        if (!canEdit) {
            toast.error("You are in read-only mode");
            return;
        }
        if (Object.keys(files).length === 1) {
            toast.error("You cannot delete the last remaining file.", { icon: '⚠️' });
            return;
        }
        setFileToDelete(fileName);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteFile = () => {
        if (!fileToDelete || !canEdit) return;

        setFiles(prev => {
            const newFiles = { ...prev };
            delete newFiles[fileToDelete];
            return newFiles;
        });
        
        setOpenFiles(prev => {
            const newOpenFiles = prev.filter(f => f !== fileToDelete);
            if (activeFile === fileToDelete) {
                setActiveFile(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null);
            }
            return newOpenFiles;
        });
        
        if (stompClient.current?.connected) {
            stompClient.current.send(`/app/code/${roomId}`, {}, JSON.stringify({ 
                sender: username, type: "DELETE", fileName: fileToDelete 
            }));
        }
        toast.success(`${fileToDelete} deleted`);
        
        setIsDeleteModalOpen(false);
        setFileToDelete(null);
    };

    const handleLanguageSelect = (e) => {
        if (!isHost || !activeFile) return; 
        const newLang = e.target.value;
        const newCode = CODE_SNIPPETS[newLang];

        setFiles(prev => ({
            ...prev,
            [activeFile]: { ...prev[activeFile], language: newLang, value: newCode }
        }));

        if (stompClient.current?.connected) {
            stompClient.current.send(`/app/code/${roomId}`, {}, JSON.stringify({ 
                sender: username, content: newCode, language: newLang, type: "CODE", fileName: activeFile 
            }));
        }
    };

    const handleEditorChange = (value) => {
        if (stompClient.current?.connected && canEdit && activeFile) { 
            setFiles(prev => ({
                ...prev,
                [activeFile]: { ...prev[activeFile], value }
            }));

            stompClient.current.send(`/app/code/${roomId}`, {}, JSON.stringify({ 
                sender: username, content: value, language: files[activeFile].language, type: "CODE", fileName: activeFile 
            }));
        }
    };

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
            setChatMsg("");
            clearTimeout(typingTimeoutRef.current);
            stompClient.current.send(`/app/typing/${roomId}`, {}, JSON.stringify({ username, isTyping: 'false' }));
        }
    };

    const formatCode = () => {
        if (!canEdit || !activeFile) return; 
        if (editorRef.current) {
            editorRef.current.getAction('editor.action.formatDocument').run();
            if (['javascript', 'typescript'].includes(files[activeFile]?.language)) {
                toast.success("Code formatted!");
            } else {
                toast("Native formatting is only available for JS/TS.", { icon: 'ℹ️' });
            }
        }
    };

    const runCode = async () => {
        if (!activeFile) return;
        setIsRunning(true);
        setOutput("Running..."); 
        try {
            const fileData = {};
            Object.keys(files).forEach(key => { fileData[key] = files[key].value; });

            const response = await axios.post(`${API_BASE_URL}/api/execute`, { 
                language: files[activeFile].language, 
                code: files[activeFile].value, 
                input: userInput,
                mainFile: activeFile,
                files: fileData 
            });
            setOutput(response.data); 
        } catch (error) { setOutput("Execution failed."); }
        finally { setIsRunning(false); }
    };

    const saveWorkspace = async () => {
        if (!isHost) return; 
        setIsSaving(true);
        try {
            const fileData = {};
            Object.keys(files).forEach(key => { fileData[key] = files[key].value; });

            await axios.post(`${API_BASE_URL}/api/workspace/${roomId}/save?username=${encodeURIComponent(username)}&roomName=${encodeURIComponent(roomName)}`, fileData);
            
            toast.success("Workspace saved to cloud! ☁️");
        } catch (error) {
            toast.error(error.response?.data || "Failed to save workspace.");
        } finally {
            setIsSaving(false);
        }
    };

    const downloadWorkspace = async () => {
        try {
            const zip = new JSZip();
            Object.keys(files).forEach(fileName => {
                zip.file(fileName, files[fileName].value);
            });
            const content = await zip.generateAsync({ type: "blob" });
            const safeRoomName = roomName.replace(/[^a-zA-Z0-9]/g, '_');
            saveAs(content, `${safeRoomName}_vylop.zip`);
            toast.success("Workspace Exported! 📦");
        } catch (error) {
            console.error("ZIP Generation Error:", error);
            toast.error("Failed to export workspace");
        }
    };

    const copyRoomLink = () => {
        const link = `${window.location.origin}/room/${roomId}`;
        navigator.clipboard.writeText(link);
        toast.success("Invite Link Copied!", { icon: '🔗' });
    };

    const handleJumpToLine = (fileName, lineNumber) => {
        if (files[fileName]) {
            if (activeFile !== fileName) {
                handleFileOpen(fileName);
            }
            setTimeout(() => {
                if (editorRef.current) {
                    editorRef.current.revealLineInCenter(lineNumber);
                    editorRef.current.setPosition({ lineNumber: lineNumber, column: 1 });
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

            const match1 = line.match(/([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+):(\d+)/);
            const match2 = line.match(/File "([^"]+)", line (\d+)/);

            let match = match1 || match2;

            if (match) {
                const fullMatch = match[0];
                const fileName = match[1];
                const lineNumber = parseInt(match[2], 10);

                const parts = line.split(fullMatch);

                return (
                    <div key={index} style={{ ...style, fontFamily: 'JetBrains Mono, monospace', lineHeight: '1.5' }}>
                        {parts[0]}
                        <span 
                            onClick={() => handleJumpToLine(fileName, lineNumber)}
                            style={{ textDecoration: 'underline', cursor: 'pointer', color: '#58a6ff', fontWeight: 'bold' }}
                            title={`Jump to line ${lineNumber} in ${fileName}`}
                        >
                            {fullMatch}
                        </span>
                        {parts[1]}
                    </div>
                );
            }
            return <div key={index} style={{ ...style, fontFamily: 'JetBrains Mono, monospace', lineHeight: '1.5' }}>{line}</div>;
        });
    };

    // --- NEW: Disambiguate Tab Names ---
    const renderTabName = (filePath) => {
        const fileName = filePath.split('/').pop();
        const duplicates = openFiles.filter(p => p.split('/').pop() === fileName);
        
        if (duplicates.length > 1) {
            const parts = filePath.split('/');
            if (parts.length > 1) {
                const parentDir = parts[parts.length - 2];
                return (
                    <span style={{ display: 'flex', alignItems: 'baseline' }}>
                        {fileName}
                        <span style={{ fontSize: '0.85em', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 'normal' }}>{parentDir}/</span>
                    </span>
                );
            }
        }
        return <span>{fileName}</span>;
    };

    return (
        <div className="app-container">
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="custom-modal">
                        <h3>Create New File</h3>
                        <div className="modal-field">
                            <label>Language</label>
                            <select 
                                className="modal-input modern-input" 
                                value={newFileLang} 
                                onChange={(e) => {
                                    setNewFileLang(e.target.value);
                                    if (!newFileName || newFileName.includes('.')) {
                                        setNewFileName(`src/NewFile.${getExtension(e.target.value)}`);
                                    }
                                }}
                            >
                                <option value="java">Java</option>
                                <option value="python">Python</option>
                                <option value="cpp">C++</option>
                                <option value="javascript">JavaScript</option>
                                <option value="typescript">TypeScript</option>
                                <option value="go">Go</option>
                                <option value="rust">Rust</option>
                                <option value="markdown">Markdown</option>
                            </select>
                        </div>
                        <div className="modal-field">
                            <label>File Name (Use slashes for folders)</label>
                            <input 
                                type="text" 
                                className="modal-input modern-input"
                                value={newFileName} 
                                onChange={(e) => setNewFileName(e.target.value)} 
                                placeholder={`e.g. src/utils/script.${getExtension(newFileLang)}`}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateNewFile()}
                                autoFocus
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCreateNewFile}>Create File</button>
                        </div>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && (
                <div className="modal-overlay">
                    <div className="custom-modal">
                        <h3>Delete File</h3>
                        <p style={{color: 'var(--text-muted)', fontSize: '0.9rem', margin: '5px 0 15px 0', lineHeight: '1.4'}}>
                            Are you sure you want to delete <strong>{fileToDelete}</strong>? <br/><br/>
                            This action cannot be undone and will delete the file for everyone currently in the room.
                        </p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
                            <button className="btn btn-danger" onClick={confirmDeleteFile}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <div className="brand-logo">
                        <span className="brand-prompt">&gt;</span><span>Vylop</span><span className="brand-cursor"></span>
                    </div>
                    <button className="btn btn-secondary btn-icon" onClick={() => setIsSidebarOpen(false)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* --- NEW: Main Sidebar Title --- */}
                <div style={{ padding: '12px 15px 4px', fontSize: '0.7rem', color: '#8b949e', letterSpacing: '1px' }}>
                    EXPLORER
                </div>

                {/* --- Collapsible File Structure Section --- */}
                <div className="sidebar-section" style={{ display: 'flex', flexDirection: 'column', flex: isExplorerExpanded ? '1 1 auto' : '0 0 auto', borderBottom: '1px solid var(--border)' }}>
                    <div 
                        onClick={() => setIsExplorerExpanded(!isExplorerExpanded)}
                        style={{ padding: '10px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#8b949e', letterSpacing: '1px', userSelect: 'none', backgroundColor: 'rgba(255,255,255,0.02)' }}
                    >
                        <svg style={{ marginRight: '6px', transform: isExplorerExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        FILE-EXPLORER
                    </div>
                    {isExplorerExpanded && (
                        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: '10px' }}>
                            <FileExplorer files={files} activeFile={activeFile} onFileClick={handleFileOpen} />
                        </div>
                    )}
                </div>
                
                {/* ... rest of the sidebar (Online Users, Chat, etc.) stays exactly the same ... */}

                {/* --- NEW: Collapsible Online Users Section --- */}
                <div className="user-list" style={{ display: 'flex', flexDirection: 'column', flex: isOnlineExpanded ? '0 0 auto' : '0 0 auto', borderBottom: '1px solid var(--border)' }}>
                    <div 
                        onClick={() => setIsOnlineExpanded(!isOnlineExpanded)}
                        style={{ padding: '10px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 'bold', color: '#8b949e', letterSpacing: '1px', userSelect: 'none', backgroundColor: 'rgba(255,255,255,0.02)' }}
                    >
                        <div style={{display: 'flex', alignItems: 'center'}}>
                            <svg style={{ marginRight: '6px', transform: isOnlineExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            ONLINE ({users.length})
                        </div>
                        <span className={`status-dot ${wsConnected ? 'connected' : 'disconnected'}`}></span>
                    </div>
                    {isOnlineExpanded && (
                        <div className="users-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '15px' }}>
                            {users.map((u, i) => (
                                <div key={i} style={{ 
                                    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                                    borderRadius: '10px', 
                                    padding: '12px', 
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ 
                                            width: '36px', height: '36px', borderRadius: '8px', 
                                            backgroundColor: getUserColor(u.username), 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                            fontWeight: 'bold', color: '#fff', fontSize: '16px',
                                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                            flexShrink: 0
                                        }}>
                                            {u.username.charAt(0).toUpperCase()}
                                        </div>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#e1e4e8', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {u.username}
                                                </span>
                                                <span style={{ width: '8px', height: '8px', backgroundColor: '#2ea043', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 6px #2ea043', flexShrink: 0 }} title="Online"></span>
                                            </div>

                                            <div style={{ display: 'flex' }}>
                                                <span style={{ 
                                                    fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px',
                                                    backgroundColor: u.role === 'HOST' ? 'rgba(210, 153, 34, 0.15)' : u.role === 'EDITOR' ? 'rgba(46, 160, 67, 0.15)' : 'rgba(139, 148, 158, 0.15)',
                                                    color: u.role === 'HOST' ? '#d29922' : u.role === 'EDITOR' ? '#3fb950' : '#8b949e',
                                                    border: `1px solid ${u.role === 'HOST' ? 'rgba(210, 153, 34, 0.4)' : u.role === 'EDITOR' ? 'rgba(46, 160, 67, 0.4)' : 'rgba(139, 148, 158, 0.4)'}`
                                                }}>
                                                    {u.role}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {isHost && u.username !== username && (
                                        <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                                            {u.role === 'READ_ONLY' ? (
                                                <button 
                                                    onClick={() => changeUserRole(u.username, 'EDITOR')} 
                                                    style={{ flex: 1, fontSize: '0.75rem', padding: '6px', background: 'rgba(46, 160, 67, 0.1)', color: '#3fb950', border: '1px solid rgba(46, 160, 67, 0.5)', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s ease', fontWeight: '600' }}
                                                    onMouseOver={(e) => { e.target.style.background = '#2ea043'; e.target.style.color = '#fff'; }}
                                                    onMouseOut={(e) => { e.target.style.background = 'rgba(46, 160, 67, 0.1)'; e.target.style.color = '#3fb950'; }}
                                                >
                                                    ↑ Promote
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => changeUserRole(u.username, 'READ_ONLY')} 
                                                    style={{ flex: 1, fontSize: '0.75rem', padding: '6px', background: 'rgba(210, 153, 34, 0.1)', color: '#d29922', border: '1px solid rgba(210, 153, 34, 0.5)', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s ease', fontWeight: '600' }}
                                                    onMouseOver={(e) => { e.target.style.background = '#d29922'; e.target.style.color = '#fff'; }}
                                                    onMouseOut={(e) => { e.target.style.background = 'rgba(210, 153, 34, 0.1)'; e.target.style.color = '#d29922'; }}
                                                >
                                                    ↓ Demote
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => kickTargetUser(u.username)} 
                                                style={{ flex: 0.6, fontSize: '0.75rem', padding: '6px', background: 'rgba(218, 54, 51, 0.1)', color: '#da3633', border: '1px solid rgba(218, 54, 51, 0.5)', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s ease', fontWeight: '600' }}
                                                onMouseOver={(e) => { e.target.style.background = '#da3633'; e.target.style.color = '#fff'; }}
                                                onMouseOut={(e) => { e.target.style.background = 'rgba(218, 54, 51, 0.1)'; e.target.style.color = '#da3633'; }}
                                            >
                                                ✕ Kick
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* --- NEW: Collapsible Chat Section --- */}
                <div className="chat-area" style={{ display: 'flex', flexDirection: 'column', flex: isChatExpanded ? '1 1 auto' : '0 0 auto', maxHeight: isChatExpanded ? '40%' : 'auto' }}>
                    <div 
                        onClick={() => setIsChatExpanded(!isChatExpanded)}
                        style={{ padding: '10px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#8b949e', letterSpacing: '1px', userSelect: 'none', backgroundColor: 'rgba(255,255,255,0.02)' }}
                    >
                        <svg style={{ marginRight: '6px', transform: isChatExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        ROOM CHAT
                    </div>
                    {isChatExpanded && (
                        <>
                            <div className="chat-messages" ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto' }}>
                                {messages.map((msg, i) => (
                                    <div key={i} className={`message ${msg.sender === username ? 'self' : 'other'}`}>
                                        <span className="msg-meta">{msg.sender}</span>
                                        <div className="msg-bubble">{msg.content}</div>
                                    </div>
                                ))}
                            </div>
                            {typingUsers.length > 0 && (
                                <div style={{ padding: '0 15px 5px', fontSize: '0.75rem', color: '#8b949e', fontStyle: 'italic' }}>
                                    {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                                </div>
                            )}
                            <div className="chat-input-area" style={{ padding: '10px', flexShrink: 0 }}>
                                <input className="modern-input" value={chatMsg} onChange={handleTypingChange} onKeyDown={(e) => e.key === 'Enter' && sendChat()} placeholder="Type a message..." />
                                <button className="btn btn-primary btn-icon" onClick={sendChat}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div className="sidebar-header" style={{borderTop: '1px solid var(--border)'}}>
                    <button className="btn btn-secondary" style={{flex:1, marginRight: '10px'}} onClick={copyRoomLink}>Copy Link</button>
                    <button className="btn btn-danger" style={{flex:1}} onClick={() => navigate('/')}>Leave</button>
                </div>
            </div>

            <div className="main-area">
                <div className="toolbar">
                    <div className="toolbar-group">
                        <button className="btn btn-secondary btn-icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <span style={{fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)'}}>{roomName}</span>
                    </div>
                    
                    <div className="toolbar-group right-controls">
                        {files[activeFile]?.language === "markdown" && (
                            <button 
                                className={`btn btn-icon ${showMarkdownPreview ? 'btn-primary' : 'btn-secondary'}`} 
                                onClick={() => setShowMarkdownPreview(!showMarkdownPreview)} 
                                title="Toggle Markdown Preview"
                                style={{marginRight: '10px'}}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                        )}

                        <button 
                            className={`btn btn-secondary btn-icon ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`} 
                            onClick={() => canEdit && setIsModalOpen(true)} 
                            title={!canEdit ? getTooltip('EDITOR') : "New File"}
                            disabled={!canEdit}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                        </button>

                        <button 
                            className={`btn btn-secondary btn-icon ${(!isHost || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`} 
                            onClick={() => isHost && saveWorkspace()} 
                            disabled={!isHost || isSaving} 
                            title={!isHost ? getTooltip('HOST') : "Save to Cloud"}
                        >
                            {isSaving ? <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>}
                        </button>

                        <button className="btn btn-secondary btn-icon" onClick={downloadWorkspace} title="Export Workspace as .zip">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </button>

                        <div className="toolbar-divider"></div>

                        <button 
                            className={`btn btn-secondary btn-icon ${!canEdit || !activeFile ? 'opacity-50 cursor-not-allowed' : ''}`} 
                            onClick={(e) => canEdit && activeFile && handleDeleteIconClick(e, activeFile)} 
                            disabled={!canEdit || !activeFile}
                            title={!canEdit ? getTooltip('EDITOR') : "Delete Current File"}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>

                        <button 
                            className={`btn btn-secondary btn-icon ${!canEdit || !activeFile ? 'opacity-50 cursor-not-allowed' : ''}`} 
                            onClick={() => canEdit && activeFile && formatCode()} 
                            disabled={!canEdit || !activeFile}
                            title={!canEdit ? getTooltip('EDITOR') : "Format Code"}
                        >
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

                        <select 
                            className={`lang-select ${!isHost || !activeFile ? 'opacity-50 cursor-not-allowed' : ''}`} 
                            value={activeFile ? files[activeFile]?.language : "java"} 
                            onChange={handleLanguageSelect} 
                            disabled={!isHost || !activeFile}
                            title={!isHost ? getTooltip('HOST') : "Select Language"}
                        >
                            <option value="java">Java</option>
                            <option value="python">Python</option>
                            <option value="cpp">C++</option>
                            <option value="javascript">JavaScript</option>
                            <option value="typescript">TypeScript</option>
                            <option value="go">Go</option>
                            <option value="rust">Rust</option>
                            <option value="markdown">Markdown</option>
                        </select>
                        <button className="btn btn-primary btn-icon" onClick={runCode} disabled={isRunning || !activeFile} title="Run Code">
                            {isRunning ? <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
                        </button>
                    </div>
                </div>

                <div className="file-tabs">
                    {/* --- NEW: Render Tabs using the disambiguation logic --- */}
                    {openFiles.map((fileName) => (
                        <div key={fileName} className={`file-tab ${activeFile === fileName ? 'active' : ''}`} onClick={() => setActiveFile(fileName)}>
                            <span className="file-tab-name" style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                                {getFileIcon(fileName.split('/').pop())}
                                {renderTabName(fileName)}
                            </span>
                            <span 
                                className="file-tab-close" 
                                onClick={(e) => handleCloseTab(e, fileName)}
                                title="Close Tab"
                            >
                                &times;
                            </span>
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
                    <Split className={`editor-split ${splitDirection}`} sizes={[70, 30]} minSize={250} gutterSize={8} direction={splitDirection}>
                        <div className="editor-wrapper">
                            {showMarkdownPreview && files[activeFile]?.language === "markdown" ? (
                                <Split className="markdown-split" sizes={[50, 50]} minSize={100} gutterSize={8} direction="horizontal" style={{ display: 'flex', height: '100%' }}>
                                    <div style={{ height: '100%' }}>
                                        <Editor 
                                            height="100%" 
                                            language="markdown" 
                                            theme={editorTheme}
                                            value={files[activeFile]?.value || ""} 
                                            onMount={handleEditorDidMount} 
                                            onChange={handleEditorChange} 
                                            options={{ 
                                                readOnly: !canEdit,
                                                domReadOnly: !canEdit,
                                                minimap: { enabled: false }, 
                                                fontSize: 14, 
                                                fontFamily: 'JetBrains Mono', 
                                                automaticLayout: true,
                                                wordWrap: 'on' 
                                            }} 
                                        />
                                    </div>
                                    <div className="markdown-preview" style={{ height: '100%', overflowY: 'auto', padding: '20px', backgroundColor: 'var(--bg-dark)', color: 'var(--text-main)' }}>
                                        <ReactMarkdown>{files[activeFile]?.value || ""}</ReactMarkdown>
                                    </div>
                                </Split>
                            ) : (
                                <div style={{ flex: 1, minHeight: 0, height: '100%' }}>
                                    <Editor 
                                        height="100%" 
                                        language={files[activeFile]?.language === "cpp" ? "cpp" : files[activeFile]?.language} 
                                        theme={editorTheme}
                                        value={files[activeFile]?.value || ""} 
                                        onMount={handleEditorDidMount} 
                                        onChange={handleEditorChange} 
                                        options={{ 
                                            readOnly: !canEdit,
                                            domReadOnly: !canEdit,
                                            minimap: { enabled: false }, 
                                            fontSize: 14, 
                                            fontFamily: 'JetBrains Mono', 
                                            automaticLayout: true, 
                                            formatOnPaste: true 
                                        }} 
                                    />
                                </div>
                            )}
                            <div id="vim-status-bar" className="vim-status-bar"></div>
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