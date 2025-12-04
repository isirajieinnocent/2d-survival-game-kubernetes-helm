# Use the official SpacetimeDB image
FROM clockworklabs/spacetime:latest

WORKDIR /app

COPY . .

# Ensure /app/data exists and symlink it to the spacetime data directory
# RUN mkdir -p /app/data /home/spacetime/.local/share/spacetime && \
#     rm -rf /home/spacetime/.local/share/spacetime/data && \
#     ln -s /app/data /home/spacetime/.local/share/spacetime/data

# RUN chown -R 1000:1000 /app/data

# VOLUME ["/app/data"]

EXPOSE 3000

# Fixed CMD - remove extra bracket and use proper format
CMD ["spacetime", "start", "-l", "spacetime-server:3000"]