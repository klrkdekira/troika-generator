.PHONY: all install dev build lint format test clean preview

# Default target
all: build

# Install dependencies
install:
	pnpm install

# Run development server
dev:
	pnpm dev

# Build project for production
build:
	pnpm build

# Run linter
lint:
	pnpm lint

# Fix lint issues automatically
lint-fix:
	pnpm lint:fix


# Format code
format:
	pnpm format

# Run unit tests
test:
	pnpm test

# Preview production build locally
preview:
	pnpm preview

# Clean build output
clean:
	rm -rf dist
