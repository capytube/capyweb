type Props = {};

export default function ActivityTable({}: Props) {
  const tableHeader = [
    { id: 1, title: 'Event', minWidth: '60px' },
    { id: 2, title: 'Price', minWidth: '60px' },
    { id: 3, title: 'Royalties', minWidth: '80px' },
    { id: 4, title: 'From', minWidth: '170px' },
    { id: 5, title: 'To', minWidth: '170px' },
    { id: 6, title: 'Time', minWidth: '88px' },
  ];

  const data = [
    {
      id: 1,
      event: 'Sale',
      price: 0.79,
      royalties: 'Paid',
      from: '0dlffkl...4trijf',
      to: '03fk0fl...2fg4',
      time: '10 days ago',
    },
    {
      id: 2,
      event: 'Sale',
      price: 0.79,
      royalties: 'Paid',
      from: '0dlffkl...4trijf',
      to: '03fk0fl...2fg4',
      time: '10 days ago',
    },
    {
      id: 3,
      event: 'Sale',
      price: 0.79,
      royalties: 'Paid',
      from: '0dlffkl...4trijf',
      to: '03fk0fl...2fg4',
      time: '10 days ago',
    },
  ];

  return (
    <table className="w-full">
      <thead>
        <tr>
          {tableHeader?.length &&
            tableHeader?.map((header) => (
              <th
                key={header?.id}
                className="text-left text-chocoBrown pr-4 font-commissioner last:pr-0"
                style={{ minWidth: header?.minWidth }}
              >
                {header?.title}
              </th>
            ))}
        </tr>
      </thead>
      <tbody>
        {data?.map((row) => (
          <tr className="">
            {Object.values(row)
              ?.slice(1)
              ?.map((value) => (
                <td
                  className={`${
                    value === 'Paid' ? 'text-siteGreen' : 'text-chocoBrown'
                  } font-commissioner pt-6`}
                  key={value}
                >
                  {value}
                </td>
              ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
