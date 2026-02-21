import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './views/Dashboard';
import PresentationView from './views/PresentationView';
import StudentView from './views/StudentView';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-50 relative overflow-hidden">
        {/* Abstract Background decorations */}
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[140px] rounded-full pointer-events-none" />

        <main className="relative z-10 w-full h-full min-h-screen">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/present/:questionId" element={<PresentationView />} />
            <Route path="/q/:questionId" element={<StudentView />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
