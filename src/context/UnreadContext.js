import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const UnreadContext = createContext();

export function UnreadProvider({ children }) {
  const [totalUnread, setTotalUnread] = useState(0);

  const updateTotal = useCallback((counts) => {
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    setTotalUnread(total);
  }, []);

  const value = useMemo(() => ({ totalUnread, updateTotal }), [totalUnread, updateTotal]);

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export const useUnread = () => useContext(UnreadContext);
