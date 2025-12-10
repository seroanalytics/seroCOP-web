/*
 * Parallel Tempering MCMC for 4-Parameter Logistic Model
 * 
 * Implements Bayesian inference for correlates of protection analysis
 * Model: P(infection) = ceiling * (sigmoid(-slope*(titre-ec50)) * (1-floor) + floor)
 * 
 * Parameters:
 *   - floor: [0,1] proportion of max risk at high titre (Beta prior)
 *   - ceiling: [0,1] max infection probability at low titre (Beta prior)
 *   - ec50: inflection point titre (Normal prior)
 *   - slope: [0,∞) steepness of curve (truncated Normal prior)
 *
 * Algorithm: Parallel Tempering with 15 temperature ladders
 * - Samples from tempered distributions: p(θ|data)^(1/T)
 * - Proposes swaps between adjacent chains
 * - Provides improved mixing for multimodal posteriors
 */

#include <vector>
#include <cmath>
#include <random>
#include <algorithm>
#include <numeric>
#include <emscripten/bind.h>

using namespace emscripten;

// Random number generator
std::mt19937 rng(std::random_device{}());

// Function to reseed the RNG (called from JavaScript)
void set_random_seed(unsigned int seed) {
    rng.seed(seed);
}

// Sigmoid function
inline double sigmoid(double x) {
    return 1.0 / (1.0 + std::exp(-x));
}

// Log-density for Beta distribution
inline double log_beta_pdf(double x, double alpha, double beta) {
    if (x <= 0.0 || x >= 1.0) return -INFINITY;
    return (alpha - 1.0) * std::log(x) + (beta - 1.0) * std::log(1.0 - x);
}

// Log-density for Normal distribution
inline double log_normal_pdf(double x, double mean, double sd) {
    double z = (x - mean) / sd;
    return -0.5 * z * z - std::log(sd) - 0.5 * std::log(2.0 * M_PI);
}

// Log-density for truncated Normal (lower bound = 0)
inline double log_truncated_normal_pdf(double x, double mean, double sd) {
    if (x <= 0.0) return -INFINITY;
    double z = (x - mean) / sd;
    double log_normalization = std::log(1.0 - 0.5 * std::erfc(-mean / (sd * std::sqrt(2.0))));
    return -0.5 * z * z - std::log(sd) - 0.5 * std::log(2.0 * M_PI) - log_normalization;
}

// Log-density for Bernoulli likelihood
inline double log_bernoulli_pmf(int y, double p) {
    if (p <= 0.0 || p >= 1.0) return -INFINITY;
    return y == 1 ? std::log(p) : std::log(1.0 - p);
}

// Model parameters structure
struct Params {
    double floor;
    double ceiling;
    double ec50;
    double slope;
    
    Params() : floor(0.5), ceiling(0.5), ec50(0.0), slope(1.0) {}
    Params(double f, double c, double e, double s) : floor(f), ceiling(c), ec50(e), slope(s) {}
};

// Prior hyperparameters
struct Priors {
    double floor_alpha, floor_beta;
    double ceiling_alpha, ceiling_beta;
    double ec50_mean, ec50_sd;
    double slope_mean, slope_sd;
    
    Priors() : floor_alpha(1.0), floor_beta(1.0), 
               ceiling_alpha(1.0), ceiling_beta(1.0),
               ec50_mean(0.0), ec50_sd(1.0),
               slope_mean(1.0), slope_sd(1.0) {}
};

// Dataset
struct Data {
    std::vector<double> titre;
    std::vector<int> infected;
    int N;
    
    Data() : N(0) {}
    Data(const std::vector<double>& t, const std::vector<int>& i) 
        : titre(t), infected(i), N(t.size()) {}
};

// Compute log-prior density
double log_prior(const Params& p, const Priors& priors) {
    double lp = 0.0;
    lp += log_beta_pdf(p.floor, priors.floor_alpha, priors.floor_beta);
    lp += log_beta_pdf(p.ceiling, priors.ceiling_alpha, priors.ceiling_beta);
    lp += log_normal_pdf(p.ec50, priors.ec50_mean, priors.ec50_sd);
    lp += log_truncated_normal_pdf(p.slope, priors.slope_mean, priors.slope_sd);
    return lp;
}

// Compute log-likelihood
double log_likelihood(const Params& p, const Data& data) {
    double ll = 0.0;
    for (int i = 0; i < data.N; ++i) {
        double prob_infection = p.ceiling * (sigmoid(-p.slope * (data.titre[i] - p.ec50)) * (1.0 - p.floor) + p.floor);
        ll += log_bernoulli_pmf(data.infected[i], prob_infection);
        if (!std::isfinite(ll)) return -INFINITY;
    }
    return ll;
}

// Compute tempered log-posterior
double log_posterior_tempered(const Params& p, const Data& data, const Priors& priors, double temperature) {
    double lp = log_prior(p, priors);
    if (!std::isfinite(lp)) return -INFINITY;
    double ll = log_likelihood(p, data);
    if (!std::isfinite(ll)) return -INFINITY;
    return lp + ll / temperature;
}

// Proposal distribution: Adaptive Gaussian random walk
class ProposalDistribution {
private:
    std::vector<double> step_sizes;
    std::normal_distribution<double> normal_dist;
    std::uniform_real_distribution<double> uniform_dist;
    
public:
    ProposalDistribution() : step_sizes(4, 0.1), normal_dist(0.0, 1.0), uniform_dist(0.0, 1.0) {}
    
    void adapt(int iteration, double acceptance_rate) {
        // Adaptive scaling: target acceptance rate ~0.234 for 4D
        double target = 0.234;
        double scale = acceptance_rate > target ? 1.01 : 0.99;
        if (iteration % 50 == 0) {
            for (auto& s : step_sizes) {
                s *= scale;
                s = std::max(0.001, std::min(s, 1.0)); // Keep reasonable bounds
            }
        }
    }
    
    Params propose(const Params& current) {
        Params proposed;
        
        // Floor: Beta proposal with reflection at boundaries
        double floor_prop = current.floor + step_sizes[0] * normal_dist(rng);
        while (floor_prop <= 0.0 || floor_prop >= 1.0) {
            if (floor_prop <= 0.0) floor_prop = -floor_prop;
            if (floor_prop >= 1.0) floor_prop = 2.0 - floor_prop;
        }
        proposed.floor = floor_prop;
        
        // Ceiling: Beta proposal with reflection
        double ceiling_prop = current.ceiling + step_sizes[1] * normal_dist(rng);
        while (ceiling_prop <= 0.0 || ceiling_prop >= 1.0) {
            if (ceiling_prop <= 0.0) ceiling_prop = -ceiling_prop;
            if (ceiling_prop >= 1.0) ceiling_prop = 2.0 - ceiling_prop;
        }
        proposed.ceiling = ceiling_prop;
        
        // EC50: Normal proposal (unbounded)
        proposed.ec50 = current.ec50 + step_sizes[2] * normal_dist(rng);
        
        // Slope: Truncated normal proposal with reflection at 0
        double slope_prop = current.slope + step_sizes[3] * normal_dist(rng);
        while (slope_prop <= 0.0) {
            slope_prop = -slope_prop; // Reflect at zero
        }
        proposed.slope = slope_prop;
        
        return proposed;
    }
};

// Single MCMC chain at given temperature
class MCMCChain {
private:
    Params current;
    double current_log_posterior;
    double temperature;
    ProposalDistribution proposal;
    std::uniform_real_distribution<double> uniform;
    int accepted;
    int total;
    
public:
    std::vector<Params> samples;
    
    MCMCChain(double temp, const Params& init, const Data& data, const Priors& priors)
        : current(init), temperature(temp), uniform(0.0, 1.0), accepted(0), total(0) {
        current_log_posterior = log_posterior_tempered(current, data, priors, temperature);
        samples.reserve(10000);
    }
    
    void step(const Data& data, const Priors& priors) {
        // Propose new state
        Params proposed = proposal.propose(current);
        double proposed_log_posterior = log_posterior_tempered(proposed, data, priors, temperature);
        
        // Metropolis-Hastings acceptance
        double log_alpha = proposed_log_posterior - current_log_posterior;
        total++;
        
        if (std::log(uniform(rng)) < log_alpha) {
            current = proposed;
            current_log_posterior = proposed_log_posterior;
            accepted++;
        }
        
        // Store sample (every chain stores, but we'll use only cold chain)
        samples.push_back(current);
        
        // Adapt proposal
        if (total % 50 == 0) {
            double acceptance_rate = static_cast<double>(accepted) / total;
            proposal.adapt(total, acceptance_rate);
        }
    }
    
    double get_log_posterior() const { return current_log_posterior; }
    Params get_current() const { return current; }
    void set_current(const Params& p, const Data& data, const Priors& priors) {
        current = p;
        current_log_posterior = log_posterior_tempered(current, data, priors, temperature);
    }
    double get_acceptance_rate() const {
        return total > 0 ? static_cast<double>(accepted) / total : 0.0;
    }
};

// Parallel Tempering MCMC Engine
class ParallelTemperingMCMC {
private:
    std::vector<MCMCChain> chains;
    std::vector<double> temperatures;
    Data data;
    Priors priors;
    int num_chains;
    int swap_accepted;
    int swap_total;
    std::uniform_real_distribution<double> uniform;
    
public:
    ParallelTemperingMCMC(int n_chains, const Data& d, const Priors& p)
        : data(d), priors(p), num_chains(n_chains), swap_accepted(0), swap_total(0), uniform(0.0, 1.0) {
        
        // Set up temperature ladder: geometric spacing
        temperatures.resize(num_chains);
        double max_temp = 10.0; // Hottest chain
        for (int i = 0; i < num_chains; ++i) {
            temperatures[i] = std::pow(max_temp, static_cast<double>(i) / (num_chains - 1));
        }
        
        // Initialize chains with random starting points
        std::uniform_real_distribution<double> init_floor(0.01, 0.5);
        std::uniform_real_distribution<double> init_ceiling(0.1, 0.9);
        std::uniform_real_distribution<double> init_ec50(-2.0, 2.0);
        std::uniform_real_distribution<double> init_slope(0.1, 3.0);
        
        for (int i = 0; i < num_chains; ++i) {
            Params init(init_floor(rng), init_ceiling(rng), init_ec50(rng), init_slope(rng));
            chains.emplace_back(temperatures[i], init, data, priors);
        }
    }
    
    void run(int n_iterations) {
        for (int iter = 0; iter < n_iterations; ++iter) {
            // Update all chains
            for (auto& chain : chains) {
                chain.step(data, priors);
            }
            
            // Attempt swaps every 10 iterations
            if (iter % 10 == 0 && num_chains > 1) {
                // Randomly select adjacent pair to swap
                std::uniform_int_distribution<int> pair_dist(0, num_chains - 2);
                int i = pair_dist(rng);
                int j = i + 1;
                
                // Compute swap probability
                double log_alpha = (chains[i].get_log_posterior() - chains[j].get_log_posterior()) *
                                   (1.0 / temperatures[j] - 1.0 / temperatures[i]);
                
                swap_total++;
                if (std::log(uniform(rng)) < log_alpha) {
                    // Swap states
                    Params temp_params = chains[i].get_current();
                    chains[i].set_current(chains[j].get_current(), data, priors);
                    chains[j].set_current(temp_params, data, priors);
                    swap_accepted++;
                }
            }
        }
    }
    
    // Get samples from cold chain (temperature = 1)
    std::vector<Params> get_samples() const {
        return chains[0].samples;
    }
    
    // Convergence diagnostics: R-hat (Gelman-Rubin statistic)
    std::vector<double> compute_rhat(int warmup) const {
        // Use multiple chains at same temperature for R-hat
        // For simplicity, use cold chain split into 2 halves
        const auto& samples = chains[0].samples;
        int n = samples.size() - warmup;
        if (n < 100) return {1.0, 1.0, 1.0, 1.0}; // Not enough samples
        
        int half = n / 2;
        std::vector<double> chain1_floor, chain1_ceiling, chain1_ec50, chain1_slope;
        std::vector<double> chain2_floor, chain2_ceiling, chain2_ec50, chain2_slope;
        
        for (int i = warmup; i < warmup + half; ++i) {
            chain1_floor.push_back(samples[i].floor);
            chain1_ceiling.push_back(samples[i].ceiling);
            chain1_ec50.push_back(samples[i].ec50);
            chain1_slope.push_back(samples[i].slope);
        }
        
        for (int i = warmup + half; i < samples.size(); ++i) {
            chain2_floor.push_back(samples[i].floor);
            chain2_ceiling.push_back(samples[i].ceiling);
            chain2_ec50.push_back(samples[i].ec50);
            chain2_slope.push_back(samples[i].slope);
        }
        
        auto compute_rhat_param = [](const std::vector<double>& c1, const std::vector<double>& c2) {
            double mean1 = std::accumulate(c1.begin(), c1.end(), 0.0) / c1.size();
            double mean2 = std::accumulate(c2.begin(), c2.end(), 0.0) / c2.size();
            double overall_mean = (mean1 + mean2) / 2.0;
            
            auto compute_var = [](const std::vector<double>& v, double m) {
                double sum = 0.0;
                for (double x : v) sum += (x - m) * (x - m);
                return sum / (v.size() - 1);
            };
            
            double var1 = compute_var(c1, mean1);
            double var2 = compute_var(c2, mean2);
            double W = (var1 + var2) / 2.0; // Within-chain variance
            
            double B = c1.size() * ((mean1 - overall_mean) * (mean1 - overall_mean) +
                                     (mean2 - overall_mean) * (mean2 - overall_mean)); // Between-chain variance
            
            double var_plus = ((c1.size() - 1.0) / c1.size()) * W + (1.0 / c1.size()) * B;
            return std::sqrt(var_plus / W);
        };
        
        return {
            compute_rhat_param(chain1_floor, chain2_floor),
            compute_rhat_param(chain1_ceiling, chain2_ceiling),
            compute_rhat_param(chain1_ec50, chain2_ec50),
            compute_rhat_param(chain1_slope, chain2_slope)
        };
    }
    
    // Effective sample size (ESS) using autocorrelation
    std::vector<double> compute_ess(int warmup) const {
        const auto& samples = chains[0].samples;
        int n = samples.size() - warmup;
        if (n < 100) return {0.0, 0.0, 0.0, 0.0};
        
        auto compute_ess_param = [n](const std::vector<double>& x) {
            double mean = std::accumulate(x.begin(), x.end(), 0.0) / x.size();
            double var = 0.0;
            for (double v : x) var += (v - mean) * (v - mean);
            var /= (x.size() - 1);
            
            // Compute autocorrelation up to lag 100
            std::vector<double> acf;
            for (int lag = 1; lag < std::min(100, static_cast<int>(x.size()) / 2); ++lag) {
                double sum = 0.0;
                for (size_t i = lag; i < x.size(); ++i) {
                    sum += (x[i] - mean) * (x[i - lag] - mean);
                }
                acf.push_back(sum / ((x.size() - lag) * var));
                
                // Stop when autocorrelation becomes negative
                if (acf.back() < 0.0) break;
            }
            
            // ESS = n / (1 + 2 * sum(acf))
            double sum_acf = std::accumulate(acf.begin(), acf.end(), 0.0);
            return x.size() / (1.0 + 2.0 * sum_acf);
        };
        
        std::vector<double> floor_vec, ceiling_vec, ec50_vec, slope_vec;
        for (int i = warmup; i < samples.size(); ++i) {
            floor_vec.push_back(samples[i].floor);
            ceiling_vec.push_back(samples[i].ceiling);
            ec50_vec.push_back(samples[i].ec50);
            slope_vec.push_back(samples[i].slope);
        }
        
        return {
            compute_ess_param(floor_vec),
            compute_ess_param(ceiling_vec),
            compute_ess_param(ec50_vec),
            compute_ess_param(slope_vec)
        };
    }
    
    double get_swap_rate() const {
        return swap_total > 0 ? static_cast<double>(swap_accepted) / swap_total : 0.0;
    }
    
    std::vector<double> get_acceptance_rates() const {
        std::vector<double> rates;
        for (const auto& chain : chains) {
            rates.push_back(chain.get_acceptance_rate());
        }
        return rates;
    }
};

// JavaScript bindings
EMSCRIPTEN_BINDINGS(parallel_tempering_module) {
    value_object<Params>("Params")
        .field("floor", &Params::floor)
        .field("ceiling", &Params::ceiling)
        .field("ec50", &Params::ec50)
        .field("slope", &Params::slope);
    
    value_object<Priors>("Priors")
        .field("floor_alpha", &Priors::floor_alpha)
        .field("floor_beta", &Priors::floor_beta)
        .field("ceiling_alpha", &Priors::ceiling_alpha)
        .field("ceiling_beta", &Priors::ceiling_beta)
        .field("ec50_mean", &Priors::ec50_mean)
        .field("ec50_sd", &Priors::ec50_sd)
        .field("slope_mean", &Priors::slope_mean)
        .field("slope_sd", &Priors::slope_sd);
    
    register_vector<double>("VectorDouble");
    register_vector<int>("VectorInt");
    register_vector<Params>("VectorParams");
    
    function("set_random_seed", &set_random_seed);
    
    class_<Data>("Data")
        .constructor<>()
        .constructor<const std::vector<double>&, const std::vector<int>&>()
        .property("N", &Data::N);
    
    class_<ParallelTemperingMCMC>("ParallelTemperingMCMC")
        .constructor<int, const Data&, const Priors&>()
        .function("run", &ParallelTemperingMCMC::run)
        .function("get_samples", &ParallelTemperingMCMC::get_samples)
        .function("compute_rhat", &ParallelTemperingMCMC::compute_rhat)
        .function("compute_ess", &ParallelTemperingMCMC::compute_ess)
        .function("get_swap_rate", &ParallelTemperingMCMC::get_swap_rate)
        .function("get_acceptance_rates", &ParallelTemperingMCMC::get_acceptance_rates);
}
