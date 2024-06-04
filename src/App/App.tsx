import {
  ButtonHTMLAttributes,
  FormHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  forwardRef,
  useMemo,
  useState,
} from 'react';

// UniqueIdGenerator
const makeUniqueIdGenerator = () => {
  let id = 0;
  return () => {
    id++;
    return `id_${id}`;
  };
};
const generateUniqueId = makeUniqueIdGenerator();

// Button component
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ children, ...props }, ref) => {
  return (
    <button {...props} ref={ref} style={{ padding: '10px 15px' }}>
      {children}
    </button>
  );
});
Button.displayName = 'Button';

// Input component
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}
export const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <input style={{ width: '100%', padding: '10px 15px' }} {...props} ref={ref} />;
});
Input.displayName = 'Input';

// Form component
interface FormProps extends FormHTMLAttributes<HTMLFormElement> {}
export const Form = forwardRef<HTMLFormElement, FormProps>((props, ref) => {
  return <form {...props} ref={ref} style={{ width: '100%' }} />;
});
Form.displayName = 'Form';

// Select component
interface SelectOption {
  value: string;
  label: string;
}
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ options, ...props }, ref) => {
  const optionList = useMemo(() => options.map((el) => ({ ...el, id: generateUniqueId() })), [options]);
  return (
    <select {...props} ref={ref} style={{ width: '100%', padding: '10px 15px' }}>
      {optionList.map((option) => (
        <option key={option.id} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
});
Select.displayName = 'Select';

// Row component
function Row({ children }: { children?: ReactNode; isColumn?: boolean }) {
  return <div style={{ display: 'flex', width: '100%' }}>{children}</div>;
}

// Column component
function Column({ children, gap = 0, padding = 0 }: { children?: ReactNode; gap?: number; padding?: number }) {
  return (
    <div style={{ display: 'flex', gap: `${gap}px`, flexDirection: 'column', padding, width: '100%' }}>{children}</div>
  );
}

// Layout component
function Layout({ children }: { children?: ReactNode }) {
  return <div style={{ maxWidth: '1024px', margin: '0 auto' }}>{children}</div>;
}

// API
const requestExecutor = async <T,>(options: Parameters<typeof fetch>): Promise<T> => {
  const response = await fetch(...options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message);
  }
  return data as T;
};

interface User {
  id: number;
  login: string;
  public_repos: number;
  name: string | null;
}
const fetchUser = (userName: string) => requestExecutor<User>([`https://api.github.com/users/${userName}`]);
interface Repo {
  name: string;
  full_name: null | string;
  stargazers_count: number;
}
const fetchRepo = (repoName: string) => requestExecutor<Repo>([`https://api.github.com/repos/${repoName}`]);

// UseRequest hook
const useRequest = <P extends unknown[], R>(fetchCb: (...args: P) => Promise<R>) => {
  const [data, setData] = useState<R | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = async (...args: P) => {
    setIsLoading(true);
    setData(null);
    setError(null);
    try {
      const res = await fetchCb(...args);
      setData(res);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('неизвестная ошибка');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clear = () => {
    setData(null);
    setIsLoading(false);
    setError(null);
  };

  return { data, error, isLoading, refetch, clear };
};

// SearchType
enum SearchTypeEnum {
  USER = 'user',
  REPO = 'repo',
}

// UseFormManger hook
type UseFormManagerValidator = (fieldValue: unknown) => null | string;
const useFormManager = <IS extends object>(
  initialState: IS,
  validators: Record<keyof IS, UseFormManagerValidator>,
  onSubmit: (values: IS) => void,
  onFormStateChange: () => void,
) => {
  const [state, setState] = useState(initialState);

  const errors = useMemo(() => {
    let isErrors = false;
    const errors: Record<string, string | null> = {};
    Object.keys(state).forEach((key) => {
      const validator = validators[key as unknown as keyof IS];
      if (validator) {
        const result = validator(state[key as unknown as keyof IS]);
        if (result !== null) {
          isErrors = true;
          errors[key] = result;
        }
      }
    });
    return { isErrors, errors };
  }, [state, validators]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!errors.isErrors) {
      onSubmit(state);
    }
  };
  const getFieldProps = (fieldName: keyof IS) => {
    return {
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        onFormStateChange();
        setState((prev) => ({ ...prev, [fieldName]: e.target.value.trim() }));
      },
      value: state[fieldName],
    };
  };

  return { handleSubmit, getState: () => state, getFieldProps, errors };
};

// searchValueValidator function
const searchValueValidator: UseFormManagerValidator = (value) => {
  if (typeof value !== 'string') {
    return 'Введенное значение не текст';
  }
  if (value.trim() === '') {
    return 'Введенное значение не должно быть пустым';
  }
  return null;
};

// SearchUserForm component
function SearchUserForm() {
  const request = useRequest(fetchUser);

  const formManager = useFormManager(
    { searchValue: '' },
    { searchValue: searchValueValidator },
    (values) => {
      request.refetch(values.searchValue);
    },
    () => {
      request.clear();
    },
  );

  return (
    <Column>
      <Form onSubmit={formManager.handleSubmit}>
        <Column gap={10} padding={20}>
          <Column>
            <Row>имя юзера</Row>
            <Row>
              <Input {...formManager.getFieldProps('searchValue')} readOnly={request.isLoading} />
            </Row>
            {(formManager.errors.isErrors && formManager.errors.errors.searchValue) ?? ''}
          </Column>
          <Row>
            <Button type={'submit'} disabled={request.isLoading}>
              Search
            </Button>
          </Row>
        </Column>
      </Form>
      {request.error !== null && <Column padding={20}>{request.error}</Column>}
      {request.data !== null && (
        <Column padding={20}>
          <Row>ИМЯ ПОЛЬЗОВАТЕЛЯ: {request.data.name ?? request.data.login}</Row>
          <Row>ЧИСЛО РЕПОЗИТОРИЕВ: {request.data.public_repos}</Row>
        </Column>
      )}
    </Column>
  );
}

// SearchRepoForm component
function SearchRepoForm() {
  const request = useRequest(fetchRepo);

  const formManager = useFormManager(
    { searchValue: '' },
    { searchValue: searchValueValidator },
    (values) => {
      request.refetch(values.searchValue);
    },
    () => {
      request.clear();
    },
  );

  return (
    <Column>
      <Form onSubmit={formManager.handleSubmit}>
        <Column gap={10} padding={20}>
          <Column>
            <Row>имя репозитория</Row>
            <Row>
              <Input {...formManager.getFieldProps('searchValue')} readOnly={request.isLoading} />
            </Row>
            {(formManager.errors.isErrors && formManager.errors.errors.searchValue) ?? ''}
          </Column>
          <Row>
            <Button type={'submit'} disabled={request.isLoading}>
              Search
            </Button>
          </Row>
        </Column>
      </Form>
      {request.error !== null && <Column padding={20}>{request.error}</Column>}
      {request.data !== null && (
        <Column padding={20}>
          <Row>ИМЯ РЕПОЗИТОРИЯ: {request.data.full_name ?? request.data.name}</Row>
          <Row>ЧИСЛО ЗВЕЗД: {request.data.stargazers_count}</Row>
        </Column>
      )}
    </Column>
  );
}

export function App() {
  const [searchType, setSearchType] = useState<string>(SearchTypeEnum.USER);

  return (
    <Layout>
      <Column padding={20}>
        <Row>
          <Select
            options={[
              { label: 'Поиск по ЮЗЕРУ', value: SearchTypeEnum.USER },
              { label: 'Поиск по РЕПОЗИТОРИЮ', value: SearchTypeEnum.REPO },
            ]}
            onChange={(e) => setSearchType(e.target.value)}
            value={searchType}
          />
        </Row>
        <Row>{searchType === SearchTypeEnum.USER && <SearchUserForm />}</Row>
        <Row>{searchType === SearchTypeEnum.REPO && <SearchRepoForm />}</Row>
      </Column>
    </Layout>
  );
}
