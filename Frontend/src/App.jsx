import { Route, Routes} from 'react-router-dom'
import Lobby from './pages/Lobby'

function App() {

  return (
    <>
       <Routes>
        <Route path="/" element={<Lobby/>} />
        <Route path="/about" element={<></>} />
       </Routes>
    </>
  )
}

export default App
