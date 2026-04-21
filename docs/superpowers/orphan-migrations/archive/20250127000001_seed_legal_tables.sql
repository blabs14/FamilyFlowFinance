-- Seed data for legal_tables
-- Description: Populates legal_tables with minimum required data for automatic deduction calculation

-- Insert SS rates (worker rate = 0.11 = 11%)
INSERT INTO legal_tables (year, region, domain, payload, effective_from, effective_to)
VALUES 
    (2024, 'continente', 'ss_rates', '{"worker": 0.11, "employer": 0.2375}', '2024-01-01', '2024-12-31'),
    (2024, 'acores', 'ss_rates', '{"worker": 0.11, "employer": 0.2375}', '2024-01-01', '2024-12-31'),
    (2024, 'madeira', 'ss_rates', '{"worker": 0.11, "employer": 0.2375}', '2024-01-01', '2024-12-31'),
    (2025, 'continente', 'ss_rates', '{"worker": 0.11, "employer": 0.2375}', '2025-01-01', '2025-12-31'),
    (2025, 'acores', 'ss_rates', '{"worker": 0.11, "employer": 0.2375}', '2025-01-01', '2025-12-31'),
    (2025, 'madeira', 'ss_rates', '{"worker": 0.11, "employer": 0.2375}', '2025-01-01', '2025-12-31')
ON CONFLICT (year, region, domain, effective_from) DO NOTHING;

-- Insert meal allowance limits
INSERT INTO legal_tables (year, region, domain, payload, effective_from, effective_to)
VALUES 
    (2024, 'continente', 'meal_allowance_limits', '{"cashPerDay": 6.00, "cardPerDay": 10.20}', '2024-01-01', '2024-12-31'),
    (2024, 'acores', 'meal_allowance_limits', '{"cashPerDay": 6.00, "cardPerDay": 10.20}', '2024-01-01', '2024-12-31'),
    (2024, 'madeira', 'meal_allowance_limits', '{"cashPerDay": 6.00, "cardPerDay": 10.20}', '2024-01-01', '2024-12-31'),
    (2025, 'continente', 'meal_allowance_limits', '{"cashPerDay": 6.00, "cardPerDay": 10.20}', '2025-01-01', '2025-12-31'),
    (2025, 'acores', 'meal_allowance_limits', '{"cashPerDay": 6.00, "cardPerDay": 10.20}', '2025-01-01', '2025-12-31'),
    (2025, 'madeira', 'meal_allowance_limits', '{"cashPerDay": 6.00, "cardPerDay": 10.20}', '2025-01-01', '2025-12-31')
ON CONFLICT (year, region, domain, effective_from) DO NOTHING;

-- Insert overtime rules
INSERT INTO legal_tables (year, region, domain, payload, effective_from, effective_to)
VALUES 
    (2024, 'continente', 'overtime_rules', '{"mode": "half_effective_rate"}', '2024-01-01', '2024-12-31'),
    (2024, 'acores', 'overtime_rules', '{"mode": "half_effective_rate"}', '2024-01-01', '2024-12-31'),
    (2024, 'madeira', 'overtime_rules', '{"mode": "half_effective_rate"}', '2024-01-01', '2024-12-31'),
    (2025, 'continente', 'overtime_rules', '{"mode": "half_effective_rate"}', '2025-01-01', '2025-12-31'),
    (2025, 'acores', 'overtime_rules', '{"mode": "half_effective_rate"}', '2025-01-01', '2025-12-31'),
    (2025, 'madeira', 'overtime_rules', '{"mode": "half_effective_rate"}', '2025-01-01', '2025-12-31')
ON CONFLICT (year, region, domain, effective_from) DO NOTHING;

-- Insert IRS withholding tables for 2025 (Continente)
-- Based on the official IRS tables with monthly rates and deductions
INSERT INTO legal_tables (year, region, domain, payload, effective_from, effective_to)
VALUES 
    (2025, 'continente', 'irs_withholding', '{
        "single": {
            "one_holder": {
                "0_dependents": [
                    {"min": 0, "max": 760, "rate": 0.0, "deduction": 0},
                    {"min": 760.01, "max": 1520, "rate": 0.145, "deduction": 110.2},
                    {"min": 1520.01, "max": 2280, "rate": 0.23, "deduction": 239.4},
                    {"min": 2280.01, "max": 3040, "rate": 0.285, "deduction": 364.8},
                    {"min": 3040.01, "max": 4560, "rate": 0.35, "deduction": 562.4},
                    {"min": 4560.01, "max": 6840, "rate": 0.37, "deduction": 653.6},
                    {"min": 6840.01, "max": 22800, "rate": 0.45, "deduction": 1201.2},
                    {"min": 22800.01, "max": null, "rate": 0.48, "deduction": 1885.2}
                ],
                "1_dependents": [
                    {"min": 0, "max": 760, "rate": 0.0, "deduction": 0},
                    {"min": 760.01, "max": 1520, "rate": 0.145, "deduction": 110.2},
                    {"min": 1520.01, "max": 2280, "rate": 0.23, "deduction": 239.4},
                    {"min": 2280.01, "max": 3040, "rate": 0.285, "deduction": 364.8},
                    {"min": 3040.01, "max": 4560, "rate": 0.35, "deduction": 562.4},
                    {"min": 4560.01, "max": 6840, "rate": 0.37, "deduction": 653.6},
                    {"min": 6840.01, "max": 22800, "rate": 0.45, "deduction": 1201.2},
                    {"min": 22800.01, "max": null, "rate": 0.48, "deduction": 1885.2}
                ]
            }
        },
        "married": {
            "one_holder": {
                "0_dependents": [
                    {"min": 0, "max": 760, "rate": 0.0, "deduction": 0},
                    {"min": 760.01, "max": 1520, "rate": 0.145, "deduction": 110.2},
                    {"min": 1520.01, "max": 2280, "rate": 0.23, "deduction": 239.4},
                    {"min": 2280.01, "max": 3040, "rate": 0.285, "deduction": 364.8},
                    {"min": 3040.01, "max": 4560, "rate": 0.35, "deduction": 562.4},
                    {"min": 4560.01, "max": 6840, "rate": 0.37, "deduction": 653.6},
                    {"min": 6840.01, "max": 22800, "rate": 0.45, "deduction": 1201.2},
                    {"min": 22800.01, "max": null, "rate": 0.48, "deduction": 1885.2}
                ]
            },
            "two_holders": {
                "0_dependents": [
                    {"min": 0, "max": 760, "rate": 0.0, "deduction": 0},
                    {"min": 760.01, "max": 1520, "rate": 0.11, "deduction": 83.6},
                    {"min": 1520.01, "max": 2280, "rate": 0.18, "deduction": 190.0},
                    {"min": 2280.01, "max": 3040, "rate": 0.23, "deduction": 304.0},
                    {"min": 3040.01, "max": 4560, "rate": 0.285, "deduction": 471.2},
                    {"min": 4560.01, "max": 6840, "rate": 0.35, "deduction": 767.6},
                    {"min": 6840.01, "max": 22800, "rate": 0.37, "deduction": 904.4},
                    {"min": 22800.01, "max": null, "rate": 0.45, "deduction": 2728.4}
                ]
            }
        }
    }', '2025-01-01', '2025-12-31')
ON CONFLICT (year, region, domain, effective_from) DO NOTHING;

-- Insert simplified IRS tables for Açores and Madeira (using same structure but different rates)
INSERT INTO legal_tables (year, region, domain, payload, effective_from, effective_to)
VALUES 
    (2025, 'acores', 'irs_withholding', '{
        "single": {
            "one_holder": {
                "0_dependents": [
                    {"min": 0, "max": 760, "rate": 0.0, "deduction": 0},
                    {"min": 760.01, "max": 1520, "rate": 0.13, "deduction": 98.8},
                    {"min": 1520.01, "max": 2280, "rate": 0.207, "deduction": 215.46},
                    {"min": 2280.01, "max": 3040, "rate": 0.2565, "deduction": 328.32},
                    {"min": 3040.01, "max": 4560, "rate": 0.315, "deduction": 506.16},
                    {"min": 4560.01, "max": 6840, "rate": 0.333, "deduction": 588.24},
                    {"min": 6840.01, "max": 22800, "rate": 0.405, "deduction": 1081.08},
                    {"min": 22800.01, "max": null, "rate": 0.432, "deduction": 1696.68}
                ]
            }
        }
    }', '2025-01-01', '2025-12-31'),
    (2025, 'madeira', 'irs_withholding', '{
        "single": {
            "one_holder": {
                "0_dependents": [
                    {"min": 0, "max": 760, "rate": 0.0, "deduction": 0},
                    {"min": 760.01, "max": 1520, "rate": 0.13, "deduction": 98.8},
                    {"min": 1520.01, "max": 2280, "rate": 0.207, "deduction": 215.46},
                    {"min": 2280.01, "max": 3040, "rate": 0.2565, "deduction": 328.32},
                    {"min": 3040.01, "max": 4560, "rate": 0.315, "deduction": 506.16},
                    {"min": 4560.01, "max": 6840, "rate": 0.333, "deduction": 588.24},
                    {"min": 6840.01, "max": 22800, "rate": 0.405, "deduction": 1081.08},
                    {"min": 22800.01, "max": null, "rate": 0.432, "deduction": 1696.68}
                ]
            }
        }
    }', '2025-01-01', '2025-12-31')
ON CONFLICT (year, region, domain, effective_from) DO NOTHING;

COMMIT;