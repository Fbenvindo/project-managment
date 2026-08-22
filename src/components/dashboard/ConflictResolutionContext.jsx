import React, { createContext, useContext } from 'react';

const ConflictResolutionContext = createContext(null);

export function ConflictResolutionProvider({ openConflictModal, children }) {
  return (
    <ConflictResolutionContext.Provider value={{ openConflictModal }}>
      {children}
    </ConflictResolutionContext.Provider>
  );
}

export function useConflictResolution() {
  return useContext(ConflictResolutionContext);
}