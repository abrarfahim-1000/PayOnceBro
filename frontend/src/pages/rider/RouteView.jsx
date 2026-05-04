import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import StopList from '../../components/rider/StopList';
import NavigationButton from '../../components/rider/NavigationButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';

const RouteView = () => {
  const [searchParams] = useSearchParams();
  const clusterId = searchParams.get('clusterId');
  const orderId = searchParams.get('orderId');
  
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeClusterId, setActiveClusterId] = useState(clusterId);
  const [activeOrderId, setActiveOrderId] = useState(orderId);

  // If no clusterId in query, fetch rider's current active assignment
  useEffect(() => {
    const fetchActiveAssignment = async () => {
      if (clusterId) {
        // Use the provided clusterId
        setActiveClusterId(clusterId);
        return;
      }
      if (orderId) {
        setActiveOrderId(orderId);
        return;
      }

      try {
        // Fetch assignments to find an active one
        const response = await api.get('/rider/assignments');
        const assignments = response.data.assignments || response.data || [];
        
        console.log('📍 Assignments fetched:', assignments);
        
        if (assignments.length === 0) {
          setError('No active assignments. Accept an order first.');
          return;
        }

        // Find first active assignment with a cluster
        const activeCluster = assignments.find(a => {
          console.log(`Checking assignment: id=${a.id}, cluster_id=${a.cluster_id}, status=${a.status}`);
          return a.cluster_id && ['accepted', 'preparing', 'pickup', 'on_the_way'].includes(a.status);
        });

        // Fallback: any active assignment (non-cluster)
        const activeOrder = assignments.find(a =>
          ['accepted', 'preparing', 'pickup', 'on_the_way'].includes(a.status)
        );
        
        console.log('📍 Active cluster assignment found:', activeCluster);
        console.log('📍 Active order assignment found:', activeOrder);

        if (activeCluster && activeCluster.cluster_id) {
          setActiveClusterId(activeCluster.cluster_id);
        } else if (activeOrder && activeOrder.id) {
          setActiveOrderId(activeOrder.id);
        } else {
          setError('No active assignment found. Start an order first.');
        }
      } catch (err) {
        setError('Failed to fetch assignments');
        console.error('Assignment fetch error:', err);
      }
    };

    fetchActiveAssignment();
  }, [clusterId, orderId]);

  // Fetch route optimization data
  useEffect(() => {
    const fetchRoute = async () => {
      if (!activeClusterId && !activeOrderId) {
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = activeClusterId
          ? await api.get(`/rider/route/${activeClusterId}`)
          : await api.get(`/rider/route/order/${activeOrderId}`);
        setRoute(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load route');
        console.error('Route fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRoute();
  }, [activeClusterId, activeOrderId]);

  if (!activeClusterId && !activeOrderId && !error) {
    return (
      <div className="p-8">
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3 text-blue-700">Loading route...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-3xl">Route Optimization</CardTitle>
            <CardDescription>Your optimized pickup and delivery route</CardDescription>
          </CardHeader>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="py-3 text-red-700">{error}</CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="py-3 text-blue-700">Optimizing your route...</CardContent>
          </Card>
        )}

        {/* Route Content */}
        {route && (
          <div className="space-y-6">
            {/* Stop List */}
            <StopList
              stops={route.orderedStops || []}
              totalDistance={route.totalDistance || 0}
              isLoading={loading}
            />

            {/* Navigation Button */}
            <NavigationButton
              mapsUrl={route.mapsUrl}
              totalDistance={route.totalDistance}
            />

            {/* Route Info Card */}
            <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardHeader>
                <CardTitle className="text-base">Route Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-700">
                <li>✓ Follow the numbered stops in order for the shortest route</li>
                <li>✓ Pickup all items from each restaurant before moving to the next</li>
                <li>✓ Deliver the complete order to the customer at the final stop</li>
                <li>✓ Click "Start Navigation" to open Google Maps</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteView;