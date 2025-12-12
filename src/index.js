import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';


window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
  isDisabled: true,
  supportsFiber: true,
  inject: () => {},
  onCommitFiberRoot: () => {},
  onCommitFiberUnmount: () => {},
};

const AuthLoadingWrapper = ({ children }) => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <LoadingPage message="Loading page, please wait..." />
    );
  }

  return children;
};


const disableCopyPaste = () => {
  // Disable right-click
  document.addEventListener("contextmenu", (event) => event.preventDefault());

  // Disable Copy, Cut, and Paste
  document.addEventListener("copy", (event) => event.preventDefault());
  document.addEventListener("cut", (event) => event.preventDefault());
  document.addEventListener("paste", (event) => event.preventDefault());

  // Disable Text Selection
  document.addEventListener("selectstart", (event) => event.preventDefault());

  // Disable Dragging
  document.addEventListener("dragstart", (event) => event.preventDefault());
};


 // disableCopyPaste();

 // Disable console logs in production
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}



const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AuthLoadingWrapper>
            <App />
        </AuthLoadingWrapper>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
