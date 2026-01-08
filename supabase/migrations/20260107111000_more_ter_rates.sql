-- Comprehensive PPh 21 TER Rates for all categories
-- Added some extra brackets for testability

-- Category A
INSERT INTO pph21_ter_rates (category_code, min_gross_income, max_gross_income, rate_percentage) VALUES
('A', 10050001, 10350000, 0.03),
('A', 10350001, 10700000, 0.035),
('A', 10700001, 999999999, 0.05); -- Catch all high

-- Category B
INSERT INTO pph21_ter_rates (category_code, min_gross_income, max_gross_income, rate_percentage) VALUES
('B', 0, 6200000, 0.00),
('B', 6200001, 6500000, 0.0025),
('B', 6500001, 6850000, 0.005),
('B', 6850001, 7300000, 0.0075),
('B', 7300001, 9200000, 0.01),
('B', 9200001, 10750000, 0.015),
('B', 10750001, 999999999, 0.05);

-- Category C
INSERT INTO pph21_ter_rates (category_code, min_gross_income, max_gross_income, rate_percentage) VALUES
('C', 0, 6600000, 0.00),
('C', 6600001, 6950000, 0.0025),
('C', 6950001, 7350000, 0.005),
('C', 7350001, 7800000, 0.0075),
('C', 7800001, 8850000, 0.01),
('C', 8850001, 999999999, 0.05);
