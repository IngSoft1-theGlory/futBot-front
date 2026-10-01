import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import SessionProvider from "./context/SessionProvider"
import App from "./App.jsx"
import "./index.css"
import GlobalEventsProvider from "./context/GlobalEventsProvider"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <GlobalEventsProvider>
          <App />
        </GlobalEventsProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>
)