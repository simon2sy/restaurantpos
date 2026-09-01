import React from 'react';
import { create, act } from 'react-test-renderer';
import ErrorBoundary from '../../src/components/ErrorBoundary';

// A component that throws on render
function ThrowError({ shouldThrow }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return React.createElement('div', null, 'Normal content');
}

describe('ErrorBoundary', () => {
  // Suppress expected console.error from error boundary
  const originalError = console.error;
  beforeAll(() => {
    console.error = (...args) => {
      if (typeof args[0] === 'string' && args[0].includes('Error')) return;
      originalError(...args);
    };
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('renders children when no error', () => {
    const tree = create(
      <ErrorBoundary>
        {React.createElement('div', null, 'Child content')}
      </ErrorBoundary>
    );

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Child content');
  });

  it('renders error UI when child throws', () => {
    let tree;
    act(() => {
      tree = create(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Something went wrong');
    expect(json).toContain('Test error');
    expect(json).toContain('Try Again');
  });

  it('recovers when Try Again is pressed', () => {
    let tree;
    let shouldThrow = true;
    const Ref = React.createRef();

    act(() => {
      tree = create(
        <ErrorBoundary ref={Ref}>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    });

    // Should be in error state
    const errorJson = JSON.stringify(tree.toJSON());
    expect(errorJson).toContain('Something went wrong');

    // Simulate recovery
    shouldThrow = false;
    act(() => {
      Ref.current.handleRetry();
      tree.update(
        <ErrorBoundary ref={Ref}>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    });

    const recoveredJson = JSON.stringify(tree.toJSON());
    expect(recoveredJson).toContain('Normal content');
  });

  it('shows the error message from the thrown error', () => {
    function ThrowSpecific() {
      throw new Error('Network timeout');
    }

    let tree;
    act(() => {
      tree = create(
        <ErrorBoundary>
          <ThrowSpecific />
        </ErrorBoundary>
      );
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Network timeout');
  });
});
