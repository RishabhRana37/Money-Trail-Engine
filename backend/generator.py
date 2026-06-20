import random
import numpy as np
from datetime import datetime, timedelta
from typing import Tuple, List, Dict, Any, Set
from backend.store import DatasetState

# Fallback names in case Faker is not available
FIRST_NAMES = [
    "Rohan", "Neha", "Aditya", "Priya", "Arjun", "Anjali", "Siddharth", "Kiran", "Vikram", "Sneha", 
    "Rahul", "Riya", "Aarav", "Tanya", "Rajesh", "Pooja", "Amit", "Preeti", "Sanjay", "Deepa",
    "Dev", "Ishaan", "Kavya", "Kabir", "Meera", "Rishi", "Saira", "Kabir", "Zara", "Yash"
]
LAST_NAMES = [
    "Sharma", "Patel", "Verma", "Rana", "Mehra", "Gupta", "Singh", "Joshi", "Rao", "Nair", 
    "Deshmukh", "Iyer", "Choudhury", "Das", "Reddy", "Kapoor", "Sen", "Bose", "Mehta", "Bhat",
    "Saxena", "Roy", "Nair", "Pillai", "Menon", "Trivedi", "Pandey", "Mishra", "Dubey", "Kohli"
]
BUSINESS_PREFIXES = [
    "Apex", "Quantum", "Nexus", "Matrix", "Vanguard", "Horizon", "Sterling", "Phoenix", "Infinity", "Alpha",
    "Delta", "Omni", "Summit", "Dynamic", "Pinnacle", "Trident", "Starlight", "Core", "Global", "Nova"
]
BUSINESS_SUFFIXES = [
    "Holdings", "Traders", "Logistics", "Enterprises", "Solutions", "Global", "Consulting", "Impex",
    "Technologies", "Ventures", "Industries", "Group", "Capital", "Partners", "Systems", "Exports"
]

try:
    from faker import Faker
    fake = Faker('en_IN')
    HAS_FAKER = True
except ImportError:
    HAS_FAKER = False

def get_random_name(account_type: str) -> str:
    if HAS_FAKER:
        try:
            if account_type == "individual":
                return fake.name()
            elif account_type == "business":
                return fake.company()
            else:
                return f"{fake.company()} Ltd"
        except Exception:
            pass
    
    # Fallback
    if account_type == "individual":
        return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    elif account_type == "business":
        return f"{random.choice(BUSINESS_PREFIXES)} {random.choice(BUSINESS_SUFFIXES)}"
    else:  # shell
        return f"{random.choice(BUSINESS_PREFIXES)} {random.choice(BUSINESS_SUFFIXES)} (Shell)"


def generate_synthetic_dataset(
    num_accounts: int = 200,
    num_transactions: int = 2500,
    fraud_intensity: str = "medium",
    seed: int = 42
) -> DatasetState:
    
    # Set seeds for reproducibility
    random.seed(seed)
    np.random.seed(seed)
    
    dataset_id = f"ds_{random.randint(100, 999)}"
    state = DatasetState(dataset_id)
    
    # Determine fraud parameters based on intensity
    if fraud_intensity == "low":
        num_rings = 2
    elif fraud_intensity == "medium":
        num_rings = 4
    else:  # high
        num_rings = 7
        
    # We will generate a fraction of accounts for fraud injection
    # e.g., 5-6 accounts per fraud ring
    fraud_accounts_needed = num_rings * 6
    normal_accounts_count = max(50, num_accounts - fraud_accounts_needed)
    
    # Generate normal accounts
    # 85% individual, 15% business
    for i in range(normal_accounts_count):
        acc_id = f"acc_{i:04d}"
        acc_type = "individual" if random.random() < 0.85 else "business"
        state.accounts[acc_id] = {
            "account_id": acc_id,
            "name": get_random_name(acc_type),
            "account_type": acc_type,
            "initial_balance": float(np.random.lognormal(mean=11.0, sigma=1.2)) # approx 20k to 200k+
        }
        
    # Base datetime range (e.g. Feb 2026)
    start_date = datetime(2026, 2, 1, 0, 0, 0)
    end_date = datetime(2026, 2, 28, 23, 59, 59)
    total_seconds = int((end_date - start_date).total_seconds())
    
    # Generate normal transactions
    # Normal patterns:
    # 1. Salaries: Business pays Individual once a month (large amounts: 35k-150k)
    # 2. Living expenses/utilities: Individual pays Business (small-medium: 500-25k)
    # 3. P2P transfers: Individual pays Individual (small: 100-15k)
    
    normal_txns = []
    normal_accounts_list = list(state.accounts.keys())
    individuals = [aid for aid, info in state.accounts.items() if info["account_type"] == "individual"]
    businesses = [aid for aid, info in state.accounts.items() if info["account_type"] == "business"]
    
    txn_counter = 1
    
    # 1. Salary transactions
    # Let's say each business pays salary to a subset of individuals
    if businesses and individuals:
        for ind in individuals:
            payer = random.choice(businesses)
            amount = round(float(np.random.uniform(30000, 140000)), 2)
            # salary day between 1st and 5th
            day_offset = random.randint(1, 5)
            salary_time = start_date + timedelta(days=day_offset, hours=random.randint(9, 17), minutes=random.randint(0, 59))
            
            normal_txns.append({
                "txn_id": f"txn_{txn_counter:05d}",
                "from_account": payer,
                "to_account": ind,
                "amount": amount,
                "timestamp": salary_time.strftime("%Y-%m-%dT%H:%M:%SZ")
            })
            txn_counter += 1

    # 2. Utility / merchant transactions
    # Individuals paying businesses multiple times a month
    num_merchant_txns = int(num_transactions * 0.6)
    if businesses and individuals:
        for _ in range(num_merchant_txns):
            sender = random.choice(individuals)
            receiver = random.choice(businesses)
            amount = round(float(np.random.lognormal(mean=7.5, sigma=1.0)), 2)
            amount = max(100.0, min(amount, 50000.0))  # bound it
            
            sec_offset = random.randint(0, total_seconds)
            txn_time = start_date + timedelta(seconds=sec_offset)
            
            normal_txns.append({
                "txn_id": f"txn_{txn_counter:05d}",
                "from_account": sender,
                "to_account": receiver,
                "amount": amount,
                "timestamp": txn_time.strftime("%Y-%m-%dT%H:%M:%SZ")
            })
            txn_counter += 1

    # 3. P2P transfers
    # Individuals sending money to other individuals
    num_p2p_txns = int(num_transactions * 0.25)
    if len(individuals) > 1:
        for _ in range(num_p2p_txns):
            sender = random.choice(individuals)
            receiver = random.choice(individuals)
            while receiver == sender:
                receiver = random.choice(individuals)
            
            amount = round(float(np.random.lognormal(mean=8.0, sigma=1.2)), 2)
            amount = max(50.0, min(amount, 30000.0))
            
            sec_offset = random.randint(0, total_seconds)
            txn_time = start_date + timedelta(seconds=sec_offset)
            
            normal_txns.append({
                "txn_id": f"txn_{txn_counter:05d}",
                "from_account": sender,
                "to_account": receiver,
                "amount": amount,
                "timestamp": txn_time.strftime("%Y-%m-%dT%H:%M:%SZ")
            })
            txn_counter += 1
            
    state.transactions.extend(normal_txns)
    
    # 4. Inject fraud patterns
    fraud_patterns = ["circular", "layering", "smurfing", "fan_in", "rapid_movement"]
    fraud_rings_count = 0
    
    # Track next account ID for fraud accounts
    next_acc_idx = normal_accounts_count
    
    for ring_idx in range(num_rings):
        pattern = random.choice(fraud_patterns)
        
        # Create a set of accounts dedicated to this fraud ring
        ring_accounts = []
        
        if pattern == "circular":
            # Circular flow: A -> B -> C -> A or A -> B -> C -> D -> A
            loop_len = random.randint(3, 5)
            for _ in range(loop_len):
                acc_id = f"acc_{next_acc_idx:04d}"
                next_acc_idx += 1
                state.accounts[acc_id] = {
                    "account_id": acc_id,
                    "name": get_random_name("shell" if random.random() < 0.7 else "individual"),
                    "account_type": "shell" if random.random() < 0.7 else "individual",
                    "initial_balance": 10000.0
                }
                ring_accounts.append(acc_id)
                state.ground_truth_dirty_accounts.add(acc_id)
            
            # Inject circular transactions
            amount = round(random.uniform(80000, 300000), 2)
            # Cycle happens within a small timeframe (e.g. 1-2 days)
            cycle_start_sec = random.randint(0, total_seconds - 172800) # leave room for 48h
            cycle_start_time = start_date + timedelta(seconds=cycle_start_sec)
            
            # Perform multiple cycle passes (e.g. 2-3 cycles)
            for cycle_pass in range(random.randint(1, 3)):
                pass_offset = cycle_pass * 86400  # daily cycles
                for i in range(loop_len):
                    sender = ring_accounts[i]
                    receiver = ring_accounts[(i + 1) % loop_len]
                    
                    # Deduct a very small "fee" at each step to simulate real laundering friction
                    step_amount = round(amount * (0.985 ** i), 2)
                    
                    txn_time = cycle_start_time + timedelta(seconds=pass_offset + (i * 3600) + random.randint(0, 1800))
                    
                    state.transactions.append({
                        "txn_id": f"txn_{txn_counter:05d}",
                        "from_account": sender,
                        "to_account": receiver,
                        "amount": step_amount,
                        "timestamp": txn_time.strftime("%Y-%m-%dT%H:%M:%SZ")
                    })
                    txn_counter += 1
            
            state.ground_truth_rings.append({
                "pattern_type": "circular",
                "account_ids": ring_accounts
            })
            fraud_rings_count += 1
            
        elif pattern == "layering":
            # Layering: A -> B -> C -> D -> E (straight chain, fast movement, high pass-through)
            chain_len = random.randint(4, 6)
            for _ in range(chain_len):
                acc_id = f"acc_{next_acc_idx:04d}"
                next_acc_idx += 1
                state.accounts[acc_id] = {
                    "account_id": acc_id,
                    "name": get_random_name("shell" if random.random() < 0.6 else "individual"),
                    "account_type": "shell" if random.random() < 0.6 else "individual",
                    "initial_balance": 5000.0
                }
                ring_accounts.append(acc_id)
                state.ground_truth_dirty_accounts.add(acc_id)
            
            amount = round(random.uniform(150000, 500000), 2)
            chain_start_sec = random.randint(0, total_seconds - 86400) # leave room for 24h
            chain_start_time = start_date + timedelta(seconds=chain_start_sec)
            
            for i in range(chain_len - 1):
                sender = ring_accounts[i]
                receiver = ring_accounts[i+1]
                step_amount = round(amount * (0.99 ** i), 2)
                # Transfer happens within 1-2 hours of the previous one
                txn_time = chain_start_time + timedelta(seconds=(i * 5400) + random.randint(0, 600))
                
                state.transactions.append({
                    "txn_id": f"txn_{txn_counter:05d}",
                    "from_account": sender,
                    "to_account": receiver,
                    "amount": step_amount,
                    "timestamp": txn_time.strftime("%Y-%m-%dT%H:%M:%SZ")
                })
                txn_counter += 1
                
            state.ground_truth_rings.append({
                "pattern_type": "layering",
                "account_ids": ring_accounts
            })
            fraud_rings_count += 1
            
        elif pattern == "smurfing":
            # Smurfing / Fan-out: One source A splits money into many mule accounts, each just under 50,000 INR
            mules_count = random.randint(5, 8)
            source_acc = f"acc_{next_acc_idx:04d}"
            next_acc_idx += 1
            state.accounts[source_acc] = {
                "account_id": source_acc,
                "name": get_random_name("business"),
                "account_type": "business",
                "initial_balance": 1000000.0
            }
            ring_accounts.append(source_acc)
            state.ground_truth_dirty_accounts.add(source_acc)
            
            for _ in range(mules_count):
                mule_acc = f"acc_{next_acc_idx:04d}"
                next_acc_idx += 1
                state.accounts[mule_acc] = {
                    "account_id": mule_acc,
                    "name": get_random_name("individual"),
                    "account_type": "individual",
                    "initial_balance": 2000.0
                }
                ring_accounts.append(mule_acc)
                state.ground_truth_dirty_accounts.add(mule_acc)
            
            # Inject transactions: source sends to each mule an amount just under 50,000 INR
            smurf_start_sec = random.randint(0, total_seconds - 43200) # within 12h
            smurf_start_time = start_date + timedelta(seconds=smurf_start_sec)
            
            for i, mule in enumerate(ring_accounts[1:]):
                amount = round(random.uniform(46500, 49800), 2)  # just under 50k threshold
                txn_time = smurf_start_time + timedelta(seconds=(i * 900) + random.randint(0, 180))
                
                state.transactions.append({
                    "txn_id": f"txn_{txn_counter:05d}",
                    "from_account": source_acc,
                    "to_account": mule,
                    "amount": amount,
                    "timestamp": txn_time.strftime("%Y-%m-%dT%H:%M:%SZ")
                })
                txn_counter += 1
                
            state.ground_truth_rings.append({
                "pattern_type": "smurfing",
                "account_ids": ring_accounts
            })
            fraud_rings_count += 1
            
        elif pattern == "fan_in":
            # Fan-in: Many accounts send money to a single collector account
            sources_count = random.randint(5, 8)
            collector_acc = f"acc_{next_acc_idx:04d}"
            next_acc_idx += 1
            state.accounts[collector_acc] = {
                "account_id": collector_acc,
                "name": get_random_name("shell"),
                "account_type": "shell",
                "initial_balance": 10000.0
            }
            ring_accounts.append(collector_acc)
            state.ground_truth_dirty_accounts.add(collector_acc)
            
            for _ in range(sources_count):
                source_acc = f"acc_{next_acc_idx:04d}"
                next_acc_idx += 1
                state.accounts[source_acc] = {
                    "account_id": source_acc,
                    "name": get_random_name("individual"),
                    "account_type": "individual",
                    "initial_balance": 100000.0
                }
                ring_accounts.append(source_acc)
                state.ground_truth_dirty_accounts.add(source_acc)
            
            # Inject fan-in transactions: sources send to collector
            fanin_start_sec = random.randint(0, total_seconds - 43200) # within 12h
            fanin_start_time = start_date + timedelta(seconds=fanin_start_sec)
            
            for i, src in enumerate(ring_accounts[1:]):
                amount = round(random.uniform(20000, 90000), 2)
                txn_time = fanin_start_time + timedelta(seconds=(i * 1200) + random.randint(0, 300))
                
                state.transactions.append({
                    "txn_id": f"txn_{txn_counter:05d}",
                    "from_account": src,
                    "to_account": collector_acc,
                    "amount": amount,
                    "timestamp": txn_time.strftime("%Y-%m-%dT%H:%M:%SZ")
                })
                txn_counter += 1
                
            state.ground_truth_rings.append({
                "pattern_type": "fan_in",
                "account_ids": ring_accounts
            })
            fraud_rings_count += 1
            
        elif pattern == "rapid_movement":
            # Rapid movement (mule): A -> Mule -> B
            # Mule forwards 95% of incoming within 24h
            mule_acc = f"acc_{next_acc_idx:04d}"
            next_acc_idx += 1
            state.accounts[mule_acc] = {
                "account_id": mule_acc,
                "name": get_random_name("individual"),
                "account_type": "shell", # shell characteristics
                "initial_balance": 1000.0
            }
            ring_accounts.append(mule_acc)
            state.ground_truth_dirty_accounts.add(mule_acc)
            
            # Select two random existing normal accounts to act as outside source/destination, or generate them
            src_acc = f"acc_{next_acc_idx:04d}"
            dest_acc = f"acc_{next_acc_idx+1:04d}"
            next_acc_idx += 2
            
            state.accounts[src_acc] = {
                "account_id": src_acc,
                "name": get_random_name("business"),
                "account_type": "business",
                "initial_balance": 1000000.0
            }
            state.accounts[dest_acc] = {
                "account_id": dest_acc,
                "name": get_random_name("individual"),
                "account_type": "individual",
                "initial_balance": 5000.0
            }
            ring_accounts.extend([src_acc, dest_acc])
            state.ground_truth_dirty_accounts.add(src_acc)
            state.ground_truth_dirty_accounts.add(dest_acc)
            
            # Inject rapid movement transactions
            amount = round(random.uniform(250000, 600000), 2)
            mule_sec = random.randint(0, total_seconds - 86400)
            in_time = start_date + timedelta(seconds=mule_sec)
            out_time = in_time + timedelta(hours=random.randint(1, 4), minutes=random.randint(0, 59))
            
            # Incoming to mule
            state.transactions.append({
                "txn_id": f"txn_{txn_counter:05d}",
                "from_account": src_acc,
                "to_account": mule_acc,
                "amount": amount,
                "timestamp": in_time.strftime("%Y-%m-%dT%H:%M:%SZ")
            })
            txn_counter += 1
            
            # Outgoing from mule (98% passed through)
            out_amount = round(amount * 0.98, 2)
            state.transactions.append({
                "txn_id": f"txn_{txn_counter:05d}",
                "from_account": mule_acc,
                "to_account": dest_acc,
                "amount": out_amount,
                "timestamp": out_time.strftime("%Y-%m-%dT%H:%M:%SZ")
            })
            txn_counter += 1
            
            state.ground_truth_rings.append({
                "pattern_type": "rapid_movement",
                "account_ids": ring_accounts
            })
            fraud_rings_count += 1
            
    # Pad with any remaining accounts to match num_accounts exactly if we generated fewer
    # (Since total accounts is dynamic, let's keep it close to num_accounts)
    current_acc_count = len(state.accounts)
    if current_acc_count < num_accounts:
        for i in range(num_accounts - current_acc_count):
            acc_id = f"acc_{next_acc_idx:04d}"
            next_acc_idx += 1
            acc_type = "individual" if random.random() < 0.85 else "business"
            state.accounts[acc_id] = {
                "account_id": acc_id,
                "name": get_random_name(acc_type),
                "account_type": acc_type,
                "initial_balance": float(np.random.lognormal(mean=11.0, sigma=1.2))
            }
            
    # Sort transactions by timestamp to keep it realistic
    state.transactions.sort(key=lambda x: x["timestamp"])
    
    return state
