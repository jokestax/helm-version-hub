import Link from "next/link";

const Sidebar = ({ onOpenHub }: { onOpenHub: () => void }) => {
  return (
    <div className="h-screen w-64 bg-gray-900 text-white p-4 flex flex-col">
      <Link
        href="/helm-version-hub"
        className="p-2 bg-blue-600 rounded-lg hover:bg-blue-700 text-center"
      >
        Helm Version Hub
      </Link>
    </div>
  );
};

export default Sidebar;
