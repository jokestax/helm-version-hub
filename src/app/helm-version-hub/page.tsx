'use client';
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { url } from 'inspector';

interface WorkloadCluster {
  cluster_name: string;
  cluster_type: string;
  status: string;
}

interface MgmtCluster {
  cluster_name: string;
  workload_clusters?: WorkloadCluster[];
}

interface Cluster {
  name: string;
  type: 'mgmt' | 'workload';
  id: string;
}

interface Application {
  name: string;
  namespace: string;
  health_status: string;
  sync_status: string;
  source: {
    type: string;
    repo_url: string;
    chart_name: string;
    path: string;
    target_revision: string;
    synced_revision: string;
    last_synced_at: string;
  };
  destination: {
    server: string;
    name: string;
  };
  container_images: string[];
  argocd_url: string;
  is_catalog_app: boolean;
}

interface ApiResponse {
  count: number;
  applications: Application[];
}

interface VersionResponse {
  versions: string[]; // Adjust the type according to the version response
}

const Sidebar = ({ onOpenHub }: { onOpenHub: () => void }) => {
  return (
    <div className="h-screen w-64 bg-gray-900 text-white p-4 flex flex-col">
      <button
        className="p-2 bg-blue-600 rounded-lg hover:bg-blue-700"
        onClick={onOpenHub}
      >
        Helm Version Hub
      </button>
    </div>
  );
};

const Home = () => {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string>(''); 
  const [selectedType, setSelectedType] = useState<string>('');
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [latestVersions, setLatestVersions] = useState<{[appName: string]: string[]}>({});
  const [loadingVersions, setLoadingVersions] = useState<{[appName: string]: boolean}>({});

  // Fetch Clusters
  useEffect(() => {
    axios.get('http://localhost:8082/api/v1/cluster')
      .then((response) => {
        const clusterSet = new Map();
        response.data.forEach((cluster: { cluster_name: any; workload_clusters: any[] }) => {
          clusterSet.set(cluster.cluster_name, {
            name: cluster.cluster_name,
            type: 'mgmt',
            id: cluster.cluster_name,
          });

          cluster.workload_clusters?.forEach((wc) => {
            if (wc.status === 'provisioned') {
              clusterSet.set(wc.cluster_name, {
                name: wc.cluster_name,
                type: 'workload',
                id: wc.cluster_name,
              });
            }
          });
        });
        setClusters(Array.from(clusterSet.values()) as Cluster[]);
      })
      .catch((err) => {
        console.error("Error fetching clusters:", err);
        setError("Failed to fetch clusters.");
      });
  }, []);

  // Fetch Applications
  useEffect(() => {
    if (selectedCluster) {
      var url: string;
      setApplications(null); // Clear existing applications
      url = `http://localhost:8082/api/v1/applications?cluster_name=${selectedCluster}&include_all=true&type=${selectedType}`;
      axios.get<ApiResponse>(url)
        .then(response => {
          setApplications(response.data.applications);
        })
        .catch(error => {
          console.error("Error fetching applications:", error);
          setError("Failed to fetch applications for this cluster.");
          setApplications(null);
        });
    }
  }, [selectedCluster]);

  // Handle selecting cluster
  const handleClusterSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectElement = event.target;
    const clusterName = selectElement.value;
    const selectedOption = selectElement.selectedOptions[0];
    const clusterType = selectedOption.getAttribute('data-type') || "nil";
  
    setSelectedType(clusterType);
    setSelectedCluster(clusterName);
    setError(null);
    setApplications(null);
    setLatestVersions({});
    setLoadingVersions({});
    setSelectedApp(null);
  };

  const handleCardClick = useCallback((appName: string) => {
    setSelectedApp(prev => (prev === appName ? null : appName));
  
    // If versions are already loaded or loading, do nothing
    if (latestVersions[appName] || loadingVersions[appName]) {
      return;
    }
  
    // Set loading state for the app
    setLoadingVersions(prevLoading => ({ ...prevLoading, [appName]: true }));
  
    // Fetch versions from the API
    axios.get<string[]>(`http://localhost:8082/api/v1/application/${appName}/version`)
      .then(response => {
        // Update the latest versions state with the new data
        setLatestVersions(prev => ({
          ...prev,
          [appName]: response.data,
        }));
      })
      .catch(error => {
        console.error("Error fetching versions:", error);
        setError(`Failed to fetch versions for ${appName}.`);
      })
      .finally(() => {
        // Reset loading state for the app
        setLoadingVersions(prevLoading => ({
          ...prevLoading,
          [appName]: false,
        }));
      });
  }, [latestVersions, loadingVersions]);

  // Get card style
  const getCardStyle = (appName: string): React.CSSProperties => {
    const isSelected = selectedApp === appName;
    return {
      cursor: 'pointer',
      height: isSelected ? 'auto' : '100px',
      overflow: 'hidden',
      position: 'relative',
      boxShadow: isSelected ? '0 4px 8px rgba(0, 0, 0, 0.2)' : 'none',
      zIndex: isSelected ? 1 : 0,
      transition: 'all 0.3s ease',
    };
  };

  return (
    <div className="flex h-screen">
      <Sidebar onOpenHub={() => setShowDropdown(true)} />
      <div className="flex-1 p-6">
        <h2 className="text-xl font-semibold">Select Cluster</h2>
        <div className="mt-4">
          <select
            className="p-2 border rounded-lg"
            onChange={handleClusterSelect}
            value={selectedCluster}
          >
            <option value="">Select a Cluster</option>
            {clusters.map((cluster) => (
              <option key={cluster.id} value={cluster.name} data-type={cluster.type}>
                {cluster.name} ({cluster.type})
              </option>
            ))}
          </select>
        </div>
        {error && <div className="text-red-500 mt-2">{error}</div>}
        <div className="grid grid-cols-3 gap-4 mt-6">
          {applications === null ? (
            <div>No applications to display. Select a cluster.</div>
          ) : (
            applications.map((app) => (
              <div
                key={app.name}
                className={`p-4 border rounded-lg`}
                onClick={() => handleCardClick(app.name)}
                style={getCardStyle(app.name)}
              >
                <h3 className="font-semibold">{app.name}</h3>
                <p>Current Version: {app.source.target_revision}</p>
                {loadingVersions[app.name] && <p>Loading versions...</p>}
                {selectedApp === app.name && latestVersions[app.name] && (
                  <div>
                    <h4>Versions Available:</h4>
                    <ul>
                      {latestVersions[app.name].map((version, index) => (
                        <li key={index}>{version}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
