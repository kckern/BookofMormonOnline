import React, { useRef, useCallback, useState, useEffect } from 'react';

/**
 * Custom hook for managing concurrent operations and preventing race conditions
 * @returns {Object} - Object with concurrent operation management functions
 */
export const useConcurrentOperations = () => {
    const activeOperations = useRef(new Set());
    const abortControllers = useRef(new Map());

    /**
     * Execute an operation with concurrency control
     * @param {string} operationId - Unique identifier for the operation
     * @param {Function} operation - Async function to execute
     * @param {Object} options - Options for the operation
     * @param {boolean} options.allowMultiple - Whether to allow multiple instances of this operation
     * @param {boolean} options.abortPrevious - Whether to abort previous instances of this operation
     * @returns {Promise} - Promise that resolves with the operation result
     */
    const executeOperation = useCallback(async (operationId, operation, options = {}) => {
        const { allowMultiple = false, abortPrevious = false } = options;
        
        // Check if operation is already running
        if (!allowMultiple && activeOperations.current.has(operationId)) {
            console.log(`Operation ${operationId} already running, skipping`);
            return null;
        }
        
        // Abort previous instance if requested
        if (abortPrevious && abortControllers.current.has(operationId)) {
            const prevController = abortControllers.current.get(operationId);
            prevController.abort();
            abortControllers.current.delete(operationId);
        }
        
        // Create abort controller for this operation
        const abortController = new AbortController();
        abortControllers.current.set(operationId, abortController);
        activeOperations.current.add(operationId);
        
        try {
            // Execute the operation with abort signal
            const result = await operation(abortController.signal);
            return result;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`Operation ${operationId} was aborted`);
                return null;
            }
            throw error;
        } finally {
            // Clean up
            activeOperations.current.delete(operationId);
            abortControllers.current.delete(operationId);
        }
    }, []);

    /**
     * Check if an operation is currently running
     * @param {string} operationId - Operation identifier to check
     * @returns {boolean} - Whether the operation is running
     */
    const isOperationRunning = useCallback((operationId) => {
        return activeOperations.current.has(operationId);
    }, []);

    /**
     * Abort a specific operation
     * @param {string} operationId - Operation identifier to abort
     */
    const abortOperation = useCallback((operationId) => {
        if (abortControllers.current.has(operationId)) {
            const controller = abortControllers.current.get(operationId);
            controller.abort();
        }
    }, []);

    /**
     * Abort all operations
     */
    const abortAllOperations = useCallback(() => {
        for (const controller of abortControllers.current.values()) {
            controller.abort();
        }
        activeOperations.current.clear();
        abortControllers.current.clear();
    }, []);

    return {
        executeOperation,
        isOperationRunning,
        abortOperation,
        abortAllOperations
    };
};

/**
 * Custom hook for debouncing values
 * @param {any} value - Value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {any} - Debounced value
 */
export const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

/**
 * Custom hook for throttling function calls
 * @param {Function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Throttled function
 */
export const useThrottle = (func, delay) => {
    const timeoutRef = useRef(null);
    const lastCallRef = useRef(0);

    return useCallback((...args) => {
        const now = Date.now();
        
        if (now - lastCallRef.current >= delay) {
            lastCallRef.current = now;
            func(...args);
        } else {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            
            timeoutRef.current = setTimeout(() => {
                lastCallRef.current = Date.now();
                func(...args);
            }, delay - (now - lastCallRef.current));
        }
    }, [func, delay]);
};
