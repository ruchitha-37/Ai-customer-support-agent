import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "database.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create the customers table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            customer_id TEXT PRIMARY KEY,
            name TEXT,
            order_date TEXT,
            product_name TEXT,
            product_type TEXT, -- 'physical', 'digital', 'custom'
            amount REAL,
            is_damaged INTEGER, -- 0 for false, 1 for true
            custom_made INTEGER -- 0 for false, 1 for true
        )
    """)
    
    # Check if we already have records
    cursor.execute("SELECT COUNT(*) FROM orders")
    count = cursor.fetchone()[0]
    
    if count == 0:
        # Populate the 15 profiles
        # Reference date in code is June 13, 2026
        # Orders within 30 days must be after May 14, 2026
        # Orders older than 30 days must be on or before May 14, 2026
        mock_orders = [
            ("C001", "John", "2026-05-01", "Runner Shoes Pro", "physical", 120.00, 0, 0),
            ("C002", "Sarah", "2026-04-01", "Smart Watch Series 5", "physical", 250.00, 0, 0),
            ("C003", "Mike", "2026-06-10", "AI Photo Editor Pro (License Key)", "digital", 99.00, 0, 0),
            ("C004", "Emma", "2026-06-08", "Custom Engraved Gold Ring", "custom", 300.00, 0, 1),
            ("C005", "David", "2026-06-03", "Premium Leather Jacket", "physical", 450.00, 0, 0),
            ("C006", "Sophia", "2026-06-05", "Pro Tablet 11-inch", "physical", 799.00, 0, 0),
            ("C007", "James", "2026-06-09", "Wireless Noise-Cancelling Earbuds", "physical", 120.00, 1, 0),
            ("C008", "Olivia", "2026-06-12", "Minimalist Cotton T-Shirt", "physical", 25.00, 0, 0),
            ("C009", "Daniel", "2026-05-28", "Drip Coffee Maker", "physical", 89.00, 0, 0),
            ("C010", "Isabella", "2026-04-29", "Luxury Designer Handbag", "physical", 650.00, 0, 0),
            ("C011", "Liam", "2026-06-11", "Python Programming E-Book", "digital", 15.00, 0, 0),
            ("C012", "Emily", "2026-06-02", "Ortho Running Shoes", "physical", 120.00, 0, 0),
            ("C013", "Noah", "2026-06-07", "Premium Smartwatch V2", "physical", 550.00, 0, 0),
            ("C014", "Ava", "2026-06-01", "Custom Monogrammed Backpack", "custom", 180.00, 0, 1),
            ("C015", "Lucas", "2026-06-08", "Ergonomic Hiking Backpack", "physical", 75.00, 1, 0)
        ]
        
        cursor.executemany("""
            INSERT INTO orders (customer_id, name, order_date, product_name, product_type, amount, is_damaged, custom_made)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, mock_orders)
        
        conn.commit()
    
    conn.close()

def get_order_by_id(customer_id: str):
    conn = sqlite3.connect(DB_PATH)
    # Return as dict
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE customer_id = ?", (customer_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None

def get_order_by_name(customer_name: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE LOWER(name) = LOWER(?)", (customer_name,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None

def get_all_orders():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)
