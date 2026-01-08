import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface VirtualTableColumn<T> {
  key: keyof T;
  title: string;
  width?: number;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

interface VirtualTableProps<T> {
  data: T[];
  columns: VirtualTableColumn<T>[];
  itemHeight?: number;
  containerHeight?: number;
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  loading?: boolean;
}

export function VirtualTable<T extends Record<string, any>>({
  data,
  columns,
  itemHeight = 50,
  containerHeight = 400,
  onRowClick,
  searchable = true,
  searchPlaceholder = "Search...",
  loading = false
}: VirtualTableProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    
    const query = searchQuery.toLowerCase();
    return data.filter(row => {
      return columns.some(column => {
        const value = row[column.key];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(query);
      });
    });
  }, [data, columns, searchQuery]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      const comparison = String(aValue).localeCompare(String(bValue));
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortKey, sortDirection]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      sortedData.length - 1,
      startIndex + Math.ceil(containerHeight / itemHeight) + 1
    );
    
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, sortedData.length]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Handle sort
  const handleSort = useCallback((key: keyof T) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }, [sortKey]);

  // Render cell content
  const renderCell = useCallback((column: VirtualTableColumn<T>, row: T) => {
    const value = row[column.key];
    
    if (column.render) {
      return column.render(value, row);
    }
    
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">-</span>;
    }
    
    return String(value);
  }, []);

  // Calculate total height
  const totalHeight = sortedData.length * itemHeight;

  // Visible items
  const visibleItems = sortedData.slice(visibleRange.startIndex, visibleRange.endIndex + 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Data Table ({sortedData.length} items)</CardTitle>
          {searchable && (
            <div className="flex items-center gap-2">
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                >
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-muted/50 border-b">
            <div className="grid" style={{ gridTemplateColumns: columns.map(col => `${col.width || 150}px`).join(' ') }}>
              {columns.map((column) => (
                <div
                  key={String(column.key)}
                  className="p-3 font-medium text-sm flex items-center gap-1"
                >
                  {column.title}
                  {column.sortable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0"
                      onClick={() => handleSort(column.key)}
                    >
                      {sortKey === column.key ? (
                        sortDirection === 'asc' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : (
                        <div className="h-3 w-3 opacity-30" />
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Virtual scrolling container */}
          <div
            ref={scrollContainerRef}
            className="relative overflow-auto"
            style={{ height: containerHeight }}
            onScroll={handleScroll}
          >
            {/* Spacer for items above visible range */}
            <div style={{ height: visibleRange.startIndex * itemHeight }} />
            
            {/* Visible items */}
            {visibleItems.map((row, index) => (
              <div
                key={`${visibleRange.startIndex + index}`}
                className="grid border-b hover:bg-muted/30 transition-colors cursor-pointer"
                style={{ 
                  gridTemplateColumns: columns.map(col => `${col.width || 150}px`).join(' '),
                  height: itemHeight
                }}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <div key={String(column.key)} className="p-3 text-sm truncate">
                    {renderCell(column, row)}
                  </div>
                ))}
              </div>
            ))}
            
            {/* Spacer for items below visible range */}
            <div style={{ height: (sortedData.length - visibleRange.endIndex - 1) * itemHeight }} />
          </div>
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && sortedData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-semibold mb-2">No data found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try adjusting your search terms' : 'No data available'}
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span>Total: {sortedData.length} items</span>
          {searchQuery && (
            <span>Filtered: {filteredData.length} items</span>
          )}
          <span>Showing: {visibleRange.startIndex + 1}-{Math.min(visibleRange.endIndex + 1, sortedData.length)} items</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Example usage component
export function ExampleVirtualTable() {
  // Generate sample data
  const sampleData = Array.from({ length: 10000 }, (_, index) => ({
    id: index + 1,
    name: `Employee ${index + 1}`,
    department: ['IT', 'HR', 'Finance', 'Marketing'][index % 4],
    position: ['Developer', 'Manager', 'Analyst', 'Designer'][index % 4],
    salary: 5000000 + (index % 10) * 1000000,
    status: ['Active', 'Inactive', 'On Leave'][index % 3]
  }));

  const columns: VirtualTableColumn<typeof sampleData[0]>[] = [
    { key: 'id', title: 'ID', width: 80, sortable: true },
    { key: 'name', title: 'Name', width: 200, sortable: true },
    { key: 'department', title: 'Department', width: 120, sortable: true },
    { key: 'position', title: 'Position', width: 150, sortable: true },
    { 
      key: 'salary', 
      title: 'Salary', 
      width: 150, 
      sortable: true,
      render: (value) => `Rp ${value.toLocaleString('id-ID')}`
    },
    { 
      key: 'status', 
      title: 'Status', 
      width: 100, 
      sortable: true,
      render: (value) => (
        <Badge variant={value === 'Active' ? 'default' : value === 'On Leave' ? 'secondary' : 'destructive'}>
          {value}
        </Badge>
      )
    }
  ];

  return (
    <div className="p-6">
      <VirtualTable
        data={sampleData}
        columns={columns}
        itemHeight={50}
        containerHeight={500}
        onRowClick={(row) => console.log('Clicked row:', row)}
        searchPlaceholder="Search employees..."
      />
    </div>
  );
}
