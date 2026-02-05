import packageJson from '../../package.json';

export default function Footer() {
    return (
        <footer className="bg-white border-t border-gray-200 mt-auto py-6">
            <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
                <div className="mb-2 md:mb-0">
                    &copy; {new Date().getFullYear()} Legal Flow. All rights reserved.
                </div>
                <div className="flex items-center gap-4">
                    <span>v{packageJson.version}</span>
                    <a href="https://github.com/caesarliu617/legal-flow" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900">
                        GitHub
                    </a>
                </div>
            </div>
        </footer>
    );
}
