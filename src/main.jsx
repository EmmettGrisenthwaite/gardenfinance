import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { registerServiceWorker } from '@/lib/serviceWorker'

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
)

registerServiceWorker()
