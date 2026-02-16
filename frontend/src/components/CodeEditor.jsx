import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Editor from "@monaco-editor/react";
import Stomp from 'stompjs';
import SockJS from 'sockjs-client';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import Client from './Client';
import './CodeEditor.css'; 

// 1. Define Language Templates
const CODE_SNIPPETS = {
    java: `// Welcome to Vylop!
// Java is selected

public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
    python: `# Welcome to Vylop!
# Python is selected

def main():
    print("Hello, World!")

if __name__ == "__main__":
    main()`,
    cpp: `// Welcome to Vylop!
// C++ is selected

#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`
};

const CodeEditor = () => {
    const { roomId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const username = location.state?.username;

    // 2. Initialize with Java snippet by default
    const [code, setCode] = useState(CODE_SNIPPETS["java"]);
    const [language, setLanguage] = useState("java"); 
    
    const [output, setOutput] = useState("");
    const [userInput, setUserInput] = useState(""); 
    const [isRunning, setIsRunning] = useState(false);
    const [users, setUsers] = useState([]); 
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [messages, setMessages] = useState([]);
    const [chatMsg, setChatMsg] = useState("");
    const chatContainerRef = useRef(null);

    const isLocalChange = useRef(false);
    const stompClient = useRef(null);
    const isConnected = useRef(false);

    useEffect(() => {
        if (!username) {
            toast.error("Username is required");
            navigate('/');
            return;
        }

        if (isConnected.current) return;
        isConnected.current = true;

        const socket = new SockJS('http://localhost:8080/ws');
        const client = Stomp.over(socket);
        
        client.connect({}, () => {
            stompClient.current = client;

            client.subscribe(`/topic/code/${roomId}`, (msg) => {
                const body = JSON.parse(msg.body);
                if (!isLocalChange.current) {
                    setCode(body.content);
                    // Sync language if changed by another user
                    if (body.language && body.language !== language) {
                        setLanguage(body.language);
                    }
                }
                isLocalChange.current = false;
            });

            client.subscribe(`/topic/users/${roomId}`, (msg) => {
                const body = JSON.parse(msg.body);
                setUsers(body.activeUsers);
                if (body.type === "JOIN" && body.username !== username) toast.success(`${body.username} joined`);
                if (body.type === "LEAVE") toast(`${body.username} left`);
            });

            client.subscribe(`/topic/chat/${roomId}`, (msg) => {
                setMessages(prev => [...prev, JSON.parse(msg.body)]);
            });

            client.send(`/app/room/${roomId}/join`, {}, JSON.stringify({ username, type: "JOIN" }));
        }, (err) => {
            console.error(err);
            isConnected.current = false;
        });

        return () => {
            if (stompClient.current?.connected) {
                stompClient.current.send(`/app/room/${roomId}/leave`, {}, JSON.stringify({ username, type: "LEAVE" }));
                stompClient.current.disconnect();
            }
        };
    }, [roomId, username, navigate]);

    useEffect(() => {
        if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }, [messages]);

    // 3. Handle Language Change
    const handleLanguageSelect = (e) => {
        const newLang = e.target.value;
        setLanguage(newLang);
        
        // Update code to the new language snippet
        const newCode = CODE_SNIPPETS[newLang];
        setCode(newCode);

        // Broadcast the language change to other users
        if (stompClient.current?.connected) {
            stompClient.current.send(`/app/code/${roomId}`, {}, JSON.stringify({ 
                sender: username, 
                content: newCode, 
                language: newLang, 
                type: "CODE" 
            }));
        }
    };

    const sendChat = () => {
        if (chatMsg.trim() && stompClient.current?.connected) {
            const payload = { sender: username, content: chatMsg };
            stompClient.current.send(`/app/chat/${roomId}`, {}, JSON.stringify(payload));
            setChatMsg("");
        }
    };

    const handleEditorChange = (value) => {
        if (stompClient.current?.connected) {
            isLocalChange.current = true;
            setCode(value);
            stompClient.current.send(`/app/code/${roomId}`, {}, JSON.stringify({ sender: username, content: value, language, type: "CODE" }));
        }
    };

    const runCode = async () => {
        setIsRunning(true);
        setOutput("Running..."); 
        try {
            const response = await axios.post('http://localhost:8080/api/execute', { language, code, input: userInput });
            setOutput(response.data); 
        } catch (error) { setOutput("Execution failed."); }
        finally { setIsRunning(false); }
    };

    const downloadCode = () => {
        const extensionMap = { "java": "java", "python": "py", "cpp": "cpp" };
        const blob = new Blob([code], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Vylop_${roomId}.${extensionMap[language] || "txt"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Downloaded!");
    };

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId);
        toast.success("Room ID Copied");
    };

    return (
        <div className="app-container">
            <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }}/>
            
            <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
                {/* --- HEADER WITH TERMINAL PROMPT --- */}
                <div className="sidebar-header">
                    <div className="brand-logo">
                        <span className="brand-prompt">&gt;</span>
                        <span>Vylop</span>
                        <span className="brand-cursor"></span>
                    </div>
                    <button className="btn btn-secondary" onClick={() => setIsSidebarOpen(false)} style={{padding: '4px 8px'}}>✕</button>
                </div>

                <div className="user-list">
                    <div className="section-title">Online ({users.length})</div>
                    {users.map((u, i) => <Client key={i} username={u} />)}
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
                    <div className="chat-input-area">
                        <input 
                            className="modern-input"
                            value={chatMsg}
                            onChange={(e) => setChatMsg(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                            placeholder="Type a message..."
                        />
                        <button className="btn btn-icon" onClick={sendChat}>➤</button>
                    </div>
                </div>

                <div className="sidebar-header" style={{borderTop: '1px solid var(--border)'}}>
                    <button className="btn btn-secondary" style={{flex:1, marginRight: '10px'}} onClick={copyRoomId}>Copy ID</button>
                    <button className="btn btn-danger" style={{flex:1}} onClick={() => navigate('/')}>Leave</button>
                </div>
            </div>

            <div className="main-area">
                <div className="toolbar">
                    <div className="toolbar-group">
                        <button className="btn btn-secondary" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
                        <span style={{fontWeight: 'bold', fontSize: '0.9rem'}}>{roomId}</span>
                    </div>
                    <div className="toolbar-group">
                        <select className="lang-select" value={language} onChange={handleLanguageSelect}>
                            <option value="java">Java</option>
                            <option value="python">Python</option>
                            <option value="cpp">C++</option>
                        </select>
                        <button className="btn btn-secondary" onClick={downloadCode} title="Download">⬇</button>
                        <button className="btn btn-primary" onClick={runCode} disabled={isRunning}>
                            {isRunning ? "Running..." : "▶ Run Code"}
                        </button>
                    </div>
                </div>

                <div className="editor-split">
                    <div className="editor-wrapper">
                        <Editor 
                            height="100%" 
                            language={language === "cpp" ? "cpp" : language} 
                            theme="vs-dark" 
                            value={code} 
                            onChange={handleEditorChange} 
                            options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono', automaticLayout: true }} 
                        />
                    </div>
                    <div className="io-wrapper">
                        <div className="io-container">
                            <div className="io-header">
                                <span>STDIN (Input)</span>
                            </div>
                            <textarea 
                                className="terminal-input" 
                                value={userInput} 
                                onChange={(e) => setUserInput(e.target.value)} 
                                placeholder="Enter input here..."
                            />
                        </div>
                        <div className="io-container" style={{borderTop: '1px solid var(--border)'}}>
                            <div className="io-header">
                                <span>STDOUT (Output)</span>
                                <button className="btn btn-secondary" style={{fontSize: '0.7rem', padding: '2px 6px'}} onClick={() => setOutput("")}>Clear</button>
                            </div>
                            <pre className="terminal-output">{output || "Run code to see output..."}</pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CodeEditor;