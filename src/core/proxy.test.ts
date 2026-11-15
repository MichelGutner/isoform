import { makeProxy } from './proxy';

describe('makeProxy', () => {
  it('should create a proxy', () => {
    const component = jest.fn();
    const builder = {
      style: jest.fn().mockReturnThis(),
      when: jest.fn().mockReturnThis(),
      attrs: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue(component),
    };
    (builder as any).constructor = builder.constructor;

    const proxy = makeProxy(component as any, builder as any);

    expect(proxy).toBeDefined();
  });

  it('should redirect to builder methods', () => {
    const component = jest.fn();
    const builder = {
      style: jest.fn().mockReturnThis(),
      when: jest.fn().mockReturnThis(),
      attrs: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue(component),
    };
    (builder as any).constructor = builder.constructor;

    const proxy = makeProxy(component as any, builder as any);

    (proxy as any).style({ padding: 16 });

    expect(builder.style).toHaveBeenCalledWith({ padding: 16 });
  });


  it('should handle method chaining', () => {
    const component = jest.fn();
    const builder = {
      style: jest.fn().mockReturnThis(),
      when: jest.fn().mockReturnThis(),
      attrs: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue(component),
    };
    (builder as any).constructor = builder.constructor;

    const proxy = makeProxy(component as any, builder as any);

    (proxy as any).style({ padding: 16 }).when('props:disabled', { opacity: 0.5 }).attrs({ testID: 'button' });

    expect(builder.style).toHaveBeenCalledWith({ padding: 16 });
    expect(builder.when).toHaveBeenCalledWith('disabled', { opacity: 0.5 });
    expect(builder.attrs).toHaveBeenCalledWith({ testID: 'button' });
  });

  it('should return proxy when builder method returns builder instance', () => {
    const component = jest.fn();
    const builder = {
      style: jest.fn(function(this: any) {
        return this;
      }),
      when: jest.fn(function(this: any) {
        return this;
      }),
      attrs: jest.fn(function(this: any) {
        return this;
      }),
      build: jest.fn().mockReturnValue(component),
    };
    (builder as any).constructor = builder.constructor;

    const proxy = makeProxy(component as any, builder as any);

    const result = (proxy as any).style({ padding: 16 });

    expect(result).toBeDefined();
    expect(builder.style).toHaveBeenCalledWith({ padding: 16 });
  });

  it('should return new proxy when builder method returns new builder instance', () => {
    const component = jest.fn();
    const builder = {
      style: jest.fn().mockReturnThis(),
      when: jest.fn().mockReturnThis(),
      attrs: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue(component),
    };
    (builder as any).constructor = builder.constructor;

    const newBuilder = {
      style: jest.fn().mockReturnThis(),
      when: jest.fn().mockReturnThis(),
      attrs: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue(component),
    };
    (newBuilder as any).constructor = builder.constructor;

    builder.style = jest.fn().mockReturnValue(newBuilder);

    const proxy = makeProxy(component as any, builder as any);

    const result = (proxy as any).style({ padding: 16 });

    expect(result).toBeDefined();
    expect(builder.style).toHaveBeenCalledWith({ padding: 16 });
  });
});
