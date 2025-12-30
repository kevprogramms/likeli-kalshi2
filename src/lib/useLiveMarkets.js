/**
 * useLiveMarkets Hook
 * 
 * Provides automatic polling for live market data from Polymarket or DFlow.
 * Keeps prices and resolution status in sync with the source platform.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { marketService } from './marketService';

// Default poll interval (30 seconds to reduce API load)
const DEFAULT_POLL_INTERVAL = 30000;

// Faster polling for active trading (5 seconds)
const FAST_POLL_INTERVAL = 5000;

/**
 * Hook for fetching and auto-updating market events
 * @param {Object} options Configuration options/**
 * @param {number} options.pollInterval - Polling interval in ms (default: 30000)
 * @param {boolean} options.enabled - Whether polling is enabled (default: true)
 * @param {boolean} options.fastMode - Use faster polling for trading (default: false)
 * @param {string} options.source - The current data source (polymarket or dflow)
 */
export function useLiveMarkets(options = {}) {
    const {
        pollInterval = DEFAULT_POLL_INTERVAL,
        enabled = true,
        fastMode = false,
        source = 'polymarket', // Accept source as parameter
    } = options;

    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isPolling, setIsPolling] = useState(false);

    const intervalRef = useRef(null);
    const mountedRef = useRef(true);

    // Determine actual poll interval (default 30s to reduce API load)
    const actualInterval = fastMode ? FAST_POLL_INTERVAL : pollInterval;

    // Fetch events - reads from the CURRENT source
    const fetchEventsInternal = async (isInitial = false) => {
        if (!mountedRef.current) return;

        const currentSource = marketService.getSource();
        console.log(`[useLiveMarkets] Fetching from source: ${currentSource}`);

        try {
            if (isInitial) setLoading(true);
            setIsPolling(true);

            const data = await marketService.getEventsForUI();
            console.log(`[useLiveMarkets] Got ${data.events?.length || 0} events from ${data.source || currentSource}`);

            if (mountedRef.current) {
                setEvents(data.events || []);
                setLastUpdated(new Date());
                setError(null);
            }
        } catch (err) {
            console.error(`[useLiveMarkets] Error fetching from ${currentSource}:`, err);
            if (mountedRef.current) {
                setError(err.message);
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
                setIsPolling(false);
            }
        }
    };

    // Manual refresh function - stable reference
    const refresh = useCallback(() => {
        return fetchEventsInternal(true);
    }, []);

    // Setup polling - RESTARTS when source changes
    useEffect(() => {
        mountedRef.current = true;

        console.log(`[useLiveMarkets] Source changed to: ${source}, restarting polling...`);

        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // Initial fetch for new source
        fetchEventsInternal(true);

        // Setup polling if enabled
        if (enabled) {
            intervalRef.current = setInterval(() => {
                fetchEventsInternal(false);
            }, actualInterval);

            console.log(`Live market updates enabled for ${source} (${actualInterval / 1000}s interval)`);
        }

        return () => {
            mountedRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, actualInterval, source]); // Include source!

    return {
        events,
        loading,
        error,
        lastUpdated,
        isPolling,
        refresh,
    };
}

/**
 * Hook for fetching and auto-updating a single event
 * @param {string} eventId - The event ID to fetch
 * @param {Object} options Configuration options
 */
export function useLiveEvent(eventId, options = {}) {
    const {
        pollInterval = DEFAULT_POLL_INTERVAL,
        enabled = true,
        fastMode = false,
    } = options;

    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    const intervalRef = useRef(null);
    const mountedRef = useRef(true);

    const actualInterval = fastMode ? FAST_POLL_INTERVAL : pollInterval;

    // Fetch single event
    const fetchEvent = useCallback(async (isInitial = false) => {
        if (!mountedRef.current || !eventId) return;

        try {
            if (isInitial) setLoading(true);

            const data = await marketService.getEventsForUI();
            const found = data.events?.find(e => e.id === eventId || e.slug === eventId);

            if (mountedRef.current) {
                if (found) {
                    setEvent(found);
                    setLastUpdated(new Date());
                    setError(null);
                } else {
                    setError('Event not found');
                }
            }
        } catch (err) {
            console.error('Error fetching event:', err);
            if (mountedRef.current) {
                setError(err.message);
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [eventId]);

    // Manual refresh
    const refresh = useCallback(() => {
        return fetchEvent(false);
    }, [fetchEvent]);

    // Setup polling
    useEffect(() => {
        mountedRef.current = true;

        fetchEvent(true);

        if (enabled && eventId) {
            intervalRef.current = setInterval(() => {
                fetchEvent(false);
            }, actualInterval);
        }

        return () => {
            mountedRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, actualInterval, eventId, fetchEvent]);

    return {
        event,
        loading,
        error,
        lastUpdated,
        refresh,
    };
}

/**
 * Format time since last update
 */
export function formatLastUpdated(date) {
    if (!date) return 'Never';

    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
}

export default useLiveMarkets;
