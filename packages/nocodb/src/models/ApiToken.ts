import { nanoid } from 'nanoid';
import type { ApiTokenType } from 'nocodb-sdk';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';

export default class ApiToken implements ApiTokenType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_user_id?: string;
  description?: string;
  permissions?: string;
  token?: string;
  expiry?: string;
  enabled?: boolean;

  constructor(audit: Partial<ApiToken | ApiTokenType>) {
    Object.assign(this, audit);
  }

  public static async insert(
    apiToken: Partial<ApiToken>,
    ncMeta = Noco.ncMeta,
  ) {
    const token = nanoid(40);
    await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.API_TOKENS,
      {
        description: apiToken.description,
        token,
        fk_user_id: apiToken.fk_user_id,
      },
      true,
    );
    return this.getByToken(token).then(async (apiToken) => {
      await NocoCache.appendToList(
        CacheScope.API_TOKEN,
        [],
        `${CacheScope.API_TOKEN}:${token}`,
      );
      return apiToken;
    });
  }

  static async list(userId: string, ncMeta = Noco.ncMeta) {
    // let tokens = await NocoCache.getList(CacheScope.API_TOKEN, []);
    // if (!tokens.length) {
    const tokens = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.API_TOKENS,
      {
        condition: { fk_user_id: userId },
      },
    );
    // await NocoCache.setList(CacheScope.API_TOKEN, [], tokens);
    // }
    return tokens?.map((t) => new ApiToken(t));
  }

  static async delete(tokenId: string, ncMeta = Noco.ncMeta) {
    const tokenData = await this.get(tokenId, ncMeta);
    await NocoCache.deepDel(
      `${CacheScope.API_TOKEN}:${tokenData.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    return await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.API_TOKENS,
      tokenId,
    );
  }

  static async getByToken(token, ncMeta = Noco.ncMeta) {
    let data =
      token &&
      (await NocoCache.get(
        `${CacheScope.API_TOKEN}:${token}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!data) {
      data = await ncMeta.metaGet(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.API_TOKENS,
        { token },
      );
      await NocoCache.set(`${CacheScope.API_TOKEN}:${token}`, data);
    }
    return data && new ApiToken(data);
  }

  public static async count(
    {
      fk_user_id,
      includeUnmappedToken = false,
    }: { fk_user_id?: string; includeUnmappedToken?: boolean } = {},
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    const qb = ncMeta.knex(MetaTable.API_TOKENS);

    if (fk_user_id) {
      qb.where(`${MetaTable.API_TOKENS}.fk_user_id`, fk_user_id);
    }

    if (includeUnmappedToken) {
      qb.orWhereNull(`${MetaTable.API_TOKENS}.fk_user_id`);
    }

    return (await qb.count('id', { as: 'count' }).first())?.count ?? 0;
  }

  public static async listWithCreatedBy(
    {
      limit = 10,
      offset = 0,
      fk_user_id,
      includeUnmappedToken = false,
    }: {
      limit: number;
      offset: number;
      fk_user_id?: string;
      includeUnmappedToken: boolean;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const queryBuilder = ncMeta
      .knex(MetaTable.API_TOKENS)
      .offset(offset)
      .limit(limit)
      .select(
        `${MetaTable.API_TOKENS}.id`,
        `${MetaTable.API_TOKENS}.token`,
        `${MetaTable.API_TOKENS}.description`,
        `${MetaTable.API_TOKENS}.fk_user_id`,
        `${MetaTable.API_TOKENS}.base_id`,
        `${MetaTable.API_TOKENS}.created_at`,
        `${MetaTable.API_TOKENS}.updated_at`,
      )
      .select(
        ncMeta
          .knex(MetaTable.USERS)
          .select('email')
          .whereRaw(
            `${MetaTable.USERS}.id = ${MetaTable.API_TOKENS}.fk_user_id`,
          )
          .as('created_by'),
      );

    if (fk_user_id) {
      queryBuilder.where(`${MetaTable.API_TOKENS}.fk_user_id`, fk_user_id);
    }

    if (includeUnmappedToken) {
      queryBuilder.orWhereNull(`${MetaTable.API_TOKENS}.fk_user_id`);
    }

    return queryBuilder;
  }

  static async get(tokenId: string, ncMeta = Noco.ncMeta) {
    return await ncMeta.metaGet(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.API_TOKENS,
      tokenId,
    );
  }
}
