import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Editor from "@monaco-editor/react";
import Stomp from 'stompjs';
import SockJS from 'sockjs-client';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import Split from 'react-split';
import { initVimMode } from 'monaco-vim';
import Client from './Client';
import './CodeEditor.css'; 

const CODE_SNIPPETS = {
    java: `// Welcome to Vylop!\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
    python: `# Welcome to Vylop!\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()`,
    cpp: `// Welcome to Vylop!\n\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
    javascript: `// Welcome to Vylop!\n\nconsole.log("Hello, World!");`,
    typescript: `// Welcome to Vylop!\n\nconst greeting: string = "Hello, World!";\nconsole.log(greeting);`,
    go: `// Welcome to Vylop!\n\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}`,
    rust: `// Welcome to Vylop!\n\nfn main() {\n    println!("Hello, World!");\n}`
};

const getExtension = (lang) => {
    const map = { java: 'java', python: 'py', cpp: 'cpp', javascript: 'js', typescript: 'ts', go: 'go', rust: 'rs' };
    return map[lang] || 'txt';
};

const getLanguageFromExtension = (fileName) => {
    const ext = fileName.split('.').pop();
    const map = { java: 'java', py: 'python', cpp: 'cpp', js: 'javascript', ts: 'typescript', go: 'go', rs: 'rust' };
    return map[ext] || 'plaintext';
};

const CURSOR_COLORS = ['#FF007F', '#00E5FF', '#FFD700', '#00FF00', '#9D00FF', '#FF7F50', '#00BFFF', '#FF1493'];

const CodeEditor = () => {
    const { roomId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    
    const username = location.state?.username;
    const roomName = location.state?.roomName || "Dev Workspace"; 

    const [files, setFiles] = useState({
        "Main.java": { name: "Main.java", language: "java", value: CODE_SNIPPETS["java"] }
    });
    const [activeFile, setActiveFile] = useState("Main.java");
    
    const [output, setOutput] = useState("");
    const [userInput, setUserInput] = useState(""); 
    const [isRunning, setIsRunning] = useState(false);
    const [isSaving, setIsSaving] = useState(false); 

    const [users, setUsers] = useState([]); 
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isVimMode, setIsVimMode] = useState(false);
    const [messages, setMessages] = useState([]);
    const [chatMsg, setChatMsg] = useState("");
    const [typingUsers, setTypingUsers] = useState([]);
    const [splitDirection, setSplitDirection] = useState(window.innerWidth < 900 ? 'vertical' : 'horizontal');

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
    const isLocalChange = useRef(false);
    const stompClient = useRef(null);
    const isConnected = useRef(false);
    const notifiedUsers = useRef(new Set()); 
    const pendingCursors = useRef({}); 
    const userColorMap = useRef({});
    const nextColorIndex = useRef(0);
    
    const hasLoaded = useRef(false);
    const disconnectTimeoutRef = useRef(null); 

    const getUserColor = (user) => {
        if (!userColorMap.current[user]) {
            userColorMap.current[user] = CURSOR_COLORS[nextColorIndex.current % CURSOR_COLORS.length];
            nextColorIndex.current += 1;
        }
        return userColorMap.current[user];
    };

    useEffect(() => {
        let isMounted = true; 

        const fetchWorkspace = async () => {
            if (hasLoaded.current) return;

            try {
                const response = await axios.get(`http://localhost:8080/api/workspace/${roomId}/load`);
                
                if (!isMounted) return;

                const loadedFiles = response.data;
                
                if (loadedFiles && Object.keys(loadedFiles).length > 0) {
                    const newFilesState = {};
                    Object.keys(loadedFiles).forEach(fileName => {
                        const content = loadedFiles[fileName];
                        const lang = getLanguageFromExtension(fileName);
                        
                        newFilesState[fileName] = {
                            name: fileName,
                            language: lang,
                            value: content
                        };
                    });
                    
                    setFiles(newFilesState);
                    setActiveFile(Object.keys(newFilesState)[0]);
                    
                    toast.success("Workspace loaded from cloud", { 
                        icon: '☁️',
                        id: 'workspace-loaded-toast' 
                    });
                    
                    hasLoaded.current = true; 
                }
            } catch (error) {
                if (isMounted) {
                    console.log("No existing workspace found or error loading from DB.", error);
                }
            }
        };

        if (roomId) {
            fetchWorkspace();
        }

        return () => {
            isMounted = false; 
        };
    }, [roomId]);

    useEffect(() => {
        const handleResize = () => setSplitDirection(window.innerWidth < 900 ? 'vertical' : 'horizontal');
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        return () => { if (vimInstanceRef.current) vimInstanceRef.current.dispose(); };
    }, []);

    useEffect(() => {
        if (!files[activeFile] && Object.keys(files).length > 0) {
            setActiveFile(Object.keys(files)[0]);
        }
    }, [files, activeFile]);

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
            if (stompClient.current?.connected) {
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

    useEffect(() => {
        if (!username) { navigate('/'); return; }

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
            
            const socket = new SockJS('http://localhost:8080/ws');
            const client = Stomp.over(socket);
            client.debug = () => {}; 
            
            client.connect({}, () => {
                stompClient.current = client;
                isConnected.current = true;
                clearTimeout(reconnectTimeout);

                client.subscribe(`/topic/code/${roomId}`, (msg) => {
                    const body = JSON.parse(msg.body);
                    
                    if (body.type === "DELETE") {
                        setFiles(prev => {
                            const newFiles = { ...prev };
                            delete newFiles[body.fileName];
                            return newFiles;
                        });
                        if (body.sender !== username) {
                            toast(`${body.sender} deleted ${body.fileName}`, { icon: '🗑️' });
                        }
                    } else if (!isLocalChange.current) {
                        setFiles(prev => ({
                            ...prev,
                            [body.fileName]: {
                                name: body.fileName,
                                language: body.language,
                                value: body.content
                            }
                        }));
                    }
                    isLocalChange.current = false;
                });

                client.subscribe(`/topic/users/${roomId}`, (msg) => {
                    const body = JSON.parse(msg.body);
                    body.activeUsers.forEach(activeUser => getUserColor(activeUser));
                    setUsers(body.activeUsers);
                    
                    Object.keys(remoteCursors.current).forEach(existingUser => {
                        if (!body.activeUsers.includes(existingUser)) {
                            if (editorRef.current) editorRef.current.removeContentWidget(remoteCursors.current[existingUser]);
                            delete remoteCursors.current[existingUser];
                        }
                    });

                    if (body.username !== username) {
                        const toastKey = `${body.type}-${body.username}`;
                        if (!notifiedUsers.current.has(toastKey)) {
                            if (body.type === "JOIN") toast.success(`${body.username} joined`);
                            if (body.type === "LEAVE") toast(`${body.username} left`);
                            notifiedUsers.current.add(toastKey);
                            setTimeout(() => notifiedUsers.current.delete(toastKey), 4000);
                        }
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
                stompClient.current = null;
            }, 200);
        };
    }, [roomId, username, navigate]); 

    useEffect(() => {
        if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }, [messages, typingUsers]);

    const handleCreateNewFile = () => {
        if (!newFileName.trim()) {
            toast.error("File name cannot be empty");
            return;
        }

        const name = newFileName.trim();
        const lang = newFileLang;
        const initialCode = CODE_SNIPPETS[lang] || `// Welcome to Vylop!\n// Start coding in ${name}...`;

        const newFile = {
            name,
            language: lang,
            value: initialCode
        };
        
        setFiles(prev => ({ ...prev, [name]: newFile }));
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
        if (Object.keys(files).length === 1) {
            toast.error("You cannot delete the last remaining file.", { icon: '⚠️' });
            return;
        }
        setFileToDelete(fileName);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteFile = () => {
        if (!fileToDelete) return;

        setFiles(prev => {
            const newFiles = { ...prev };
            delete newFiles[fileToDelete];
            return newFiles;
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
        const newLang = e.target.value;
        const newCode = CODE_SNIPPETS[newLang];

        setFiles(prev => ({
            ...prev,
            [activeFile]: {
                ...prev[activeFile],
                language: newLang,
                value: newCode
            }
        }));

        if (stompClient.current?.connected) {
            stompClient.current.send(`/app/code/${roomId}`, {}, JSON.stringify({ 
                sender: username, content: newCode, language: newLang, type: "CODE", fileName: activeFile 
            }));
        }
    };

    const handleEditorChange = (value) => {
        if (stompClient.current?.connected) {
            isLocalChange.current = true;
            
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
        setIsRunning(true);
        setOutput("Running..."); 
        try {
            const fileData = {};
            Object.keys(files).forEach(key => {
                fileData[key] = files[key].value;
            });

            const response = await axios.post('http://localhost:8080/api/execute', { 
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
        setIsSaving(true);
        try {
            const fileData = {};
            Object.keys(files).forEach(key => {
                fileData[key] = files[key].value;
            });

            await axios.post(`http://localhost:8080/api/workspace/${roomId}/save?username=${encodeURIComponent(username)}&roomName=${encodeURIComponent(roomName)}`, fileData);
            
            toast.success("Workspace saved to cloud! ☁️");
        } catch (error) {
            toast.error(error.response?.data || "Failed to save workspace.");
        } finally {
            setIsSaving(false);
        }
    };

    const downloadCode = () => {
        const file = files[activeFile];
        const blob = new Blob([file.value], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`${file.name} Downloaded!`);
    };

    return (
        <div className="app-container">
            <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }}/>
            
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
                                        setNewFileName(`NewFile.${getExtension(e.target.value)}`);
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
                            </select>
                        </div>
                        <div className="modal-field">
                            <label>File Name</label>
                            <input 
                                type="text" 
                                className="modal-input modern-input"
                                value={newFileName} 
                                onChange={(e) => setNewFileName(e.target.value)} 
                                placeholder={`e.g. script.${getExtension(newFileLang)}`}
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

                <div className="user-list">
                    <div className="section-title">Online ({users.length})</div>
                    {users.map((u, i) => <Client key={i} username={u} color={getUserColor(u)} />)}
                </div>

                <div className="chat-area">
                    <div className="chat-messages" ref={chatContainerRef}>
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
                    <div className="chat-input-area">
                        <input className="modern-input" value={chatMsg} onChange={handleTypingChange} onKeyDown={(e) => e.key === 'Enter' && sendChat()} placeholder="Type a message..." />
                        <button className="btn btn-primary btn-icon" onClick={sendChat}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                        </button>
                    </div>
                </div>

                <div className="sidebar-header" style={{borderTop: '1px solid var(--border)'}}>
                    <button className="btn btn-secondary" style={{flex:1, marginRight: '10px'}} onClick={() => {navigator.clipboard.writeText(roomId); toast.success("Copied!");}}>Copy ID</button>
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
                        {/* Group 1: File Management */}
                        <button className="btn btn-secondary btn-icon" onClick={() => setIsModalOpen(true)} title="New File">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                        </button>
                        <button className="btn btn-secondary btn-icon" onClick={saveWorkspace} disabled={isSaving} title="Save to Cloud">
                            {isSaving ? <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>}
                        </button>
                        <button className="btn btn-secondary btn-icon" onClick={downloadCode} title="Download File">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </button>

                        <div className="toolbar-divider"></div>

                        {/* Group 2: Editor Tools */}
                        <button className="btn btn-secondary btn-icon" onClick={formatCode} title="Format Code">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>
                        </button>
                        <button className={`btn btn-icon ${isVimMode ? 'btn-primary' : 'btn-secondary'}`} onClick={toggleVimMode} title={isVimMode ? "Disable Vim Mode" : "Enable Vim Mode"}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                        </button>

                        <div className="toolbar-divider"></div>

                        {/* Group 3: Environment & Execution */}
                        <select className="lang-select" value={files[activeFile]?.language || "java"} onChange={handleLanguageSelect} title="Select Language">
                            <option value="java">Java</option>
                            <option value="python">Python</option>
                            <option value="cpp">C++</option>
                            <option value="javascript">JavaScript</option>
                            <option value="typescript">TypeScript</option>
                            <option value="go">Go</option>
                            <option value="rust">Rust</option>
                        </select>
                        <button className="btn btn-primary btn-icon" onClick={runCode} disabled={isRunning} title="Run Code">
                            {isRunning ? <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
                        </button>
                    </div>
                </div>

                <div className="file-tabs">
                    {Object.keys(files).map((fileName) => (
                        <div key={fileName} className={`file-tab ${activeFile === fileName ? 'active' : ''}`} onClick={() => setActiveFile(fileName)}>
                            <span className="file-tab-name">{fileName}</span>
                            {Object.keys(files).length > 1 && (
                                <span 
                                    className="file-tab-close" 
                                    onClick={(e) => handleDeleteIconClick(e, fileName)}
                                    title="Delete File"
                                >
                                    &times;
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                <Split className={`editor-split ${splitDirection}`} sizes={[70, 30]} minSize={250} gutterSize={8} direction={splitDirection}>
                    <div className="editor-wrapper">
                        <div style={{ flex: 1, minHeight: 0 }}>
                            <Editor 
                                height="100%" 
                                language={files[activeFile]?.language === "cpp" ? "cpp" : files[activeFile]?.language} 
                                theme="vs-dark" 
                                value={files[activeFile]?.value || ""} 
                                onMount={handleEditorDidMount} 
                                onChange={handleEditorChange} 
                                options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono', automaticLayout: true, formatOnPaste: true }} 
                            />
                        </div>
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
                            <pre className="terminal-output">{output || "Run code to see output..."}</pre>
                        </div>
                    </div>
                </Split>
            </div>
        </div>
    );
};

export default CodeEditor;