import { useState } from 'react'
import './App.css'
import WidgetContainer from './component/WidgetContainer/WidgetContainer'
import WidgetLauncher from './component/WidgetLauncher/WidgetLauncher'

function App() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open ? (
        <WidgetContainer onClose={() => setOpen(false)} />
      ) : (
        <WidgetLauncher onOpen={() => setOpen(true)} />
      )}
    </>
  )
}

export default App
