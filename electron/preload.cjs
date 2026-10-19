const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("terminal", {
  call: (action, args) => ipcRenderer.invoke("terminal", action, args),
  subscribe: (handler) => {
    const listener = (_, value) => handler(value);
    ipcRenderer.on("terminal-event", listener);
    return () => ipcRenderer.removeListener("terminal-event", listener);
  },
});
