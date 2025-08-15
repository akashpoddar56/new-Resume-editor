import React from 'react';

interface LeftSidebarProps {
  activeTab: 'alignment' | null;
  toggleSidebar: (sidebar: 'alignment') => void;
}

const NavButton = ({ icon, label, isActive, onClick }: { icon: string, label: string, isActive: boolean, onClick: () => void }) => {
  const activeClasses = 'text-indigo-600 bg-indigo-100';
  const inactiveClasses = 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50';
  return (
    <button onClick={onClick} className={`p-2 rounded-lg ${isActive ? activeClasses : inactiveClasses}`} aria-label={label}>
      <span className="material-icons">{icon}</span>
    </button>
  );
};

const LeftSidebar: React.FC<LeftSidebarProps> = ({ activeTab, toggleSidebar }) => {
  
  const handleDescriptionClick = () => {
    // If any tab is active, calling toggle with that tab name will close it.
    if (activeTab) {
      toggleSidebar(activeTab);
    }
  };

  return (
    <aside className="w-20 bg-white shadow-md flex-col items-center py-6 hidden md:flex no-print">
      <div className="text-indigo-600 font-bold text-2xl mb-12">R</div>
      <nav className="flex flex-col space-y-6">
        <NavButton
          icon="description"
          label="Resume View"
          isActive={!activeTab}
          onClick={handleDescriptionClick}
        />
        <NavButton
          icon="work_outline"
          label="Job Alignment"
          isActive={activeTab === 'alignment'}
          onClick={() => toggleSidebar('alignment')}
        />
      </nav>
      <div className="mt-auto">
        <a className="text-gray-400 hover:text-indigo-600 p-2 rounded-lg" href="#">
          <span className="material-icons">logout</span>
        </a>
      </div>
    </aside>
  );
};

export default LeftSidebar;